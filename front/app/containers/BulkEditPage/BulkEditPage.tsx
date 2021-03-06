import * as React from 'react';
import { match } from 'react-router';
import { History } from 'history';
import { WorkflowsViewFragment } from 'types/WorkflowsViewFragment';
import { WorkflowConfigFragment } from 'types/WorkflowConfigFragment';
import { displayFields } from 'utils/siteViewHelpers';
import { gql } from 'apollo-boost';
import { Query, Mutation } from 'react-apollo';
import {
  path,
  pathOr,
  drop,
  addIndex,
  map,
  pipe,
  isNil,
  omit,
  find,
  propEq,
  lensPath,
  set,
  keys,
  reject,
  filter,
  equals,
  isEmpty,
  prop,
  propOr,
  uniq,
} from 'ramda';
import SiteProvider from 'containers/SiteProvider';
import WorkflowsViewProvider from 'containers/WorkflowsViewProvider';
import BulkEditView from './BulkEditView';
import {
  SearchPageParamsQueryVariables,
  SearchPageParamsQuery_searchParams,
} from 'types/SearchPageParamsQuery';
import SearchPageParamsQuery from 'queries/SearchPageParamsQuery';
import { SearchQueryInput } from 'types/globalTypes';
import { SearchPageSearchQueryVariables } from 'types/SearchPageSearchQuery';
import {
  BulkQueryUpdateMutation,
  BulkQueryUpdateMutationVariables,
} from 'types/BulkQueryUpdateMutation';

const BULK_QUERY_UPDATE_MUTATION = gql`
  mutation BulkQueryUpdateMutation($input: BulkQueryUpdateInput!) {
    bulkQueryUpdate(input: $input) {
      clientMutationId
      undoActions {
        nctId
        state {
          enable
          name
          value
        }
      }
    }
  }
`;
const BULK_LIST_UPDATE_MUTATION = gql`
  mutation BulkListUpdateMutation($input: BulkListUpdateInput!) {
    bulkListUpdate(input: $input) {
      clientMutationId
    }
  }
`;

const LABELS_QUERY = gql`
  query BulkLabelsQuery($searchHash: String!, $params: SearchInput!) {
    myCrowdAggs: aggBuckets(searchHash: $searchHash, params: $params) {
      aggs {
        name
        buckets {
          key
          docCount
        }
      }
    }
    allCrowdAggs: aggBuckets(
      params: { page: 0, q: { key: "*" }, agg: "front_matter_keys" }
    ) {
      aggs {
        name
        buckets {
          key
          docCount
        }
      }
    }
    search(searchHash: $searchHash) {
      recordsTotal
    }
  }
`;
// escape label
const el = (label: string) => label.replace(/ /g, '').replace('|', '_');

const buildParams = (labels: string[]): string => {
  return labels.reduce(
    (s, label) => `$${el(label)}Params: SearchInput! ${s}`,
    ''
  );
};

const variablesForLabels = (labels: string[], params: any) => {
  return labels.reduce(
    (variables, label) => ({
      ...variables,
      [`${el(label)}Params`]: {
        ...params,
        agg: label,
      },
    }),
    {}
  );
};

const bucketsForLabels = (labels: string[]) => {
  const query = gql`
  query BucketsForLabelsQuery (${buildParams(labels)}) {
    ${labels.reduce(
      (s, l) => `
      ${s}
      ${el(l)}Selected: crowdAggBuckets(
        params:   $${el(l)}Params
      ) {
        aggs {
          name
          buckets {
            key
            docCount
          }
        }
      }
      ${el(l)}All: crowdAggBuckets(
        params: { agg: "${l}", q: { key: "*" }, page: 0, pageSize: 25 }
      ) {
        aggs {
          name
          buckets {
            key
            docCount
          }
        }
      }
    `,
      ''
    )}
  }
  `;
  return query;
};

const extractBucketKeys = pipe(
  pathOr([], ['aggs', 0, 'buckets']),
  map(prop('key'))
);

const groupBucketsByLabel = ({ data, labels }) =>
  labels.reduce(
    (accum, label) => ({
      ...accum,
      [label]: {
        all: extractBucketKeys(data[`${el(label)}All`]),
        selected: extractBucketKeys(data[`${el(label)}Selected`]),
      },
    }),
    {}
  );

interface BulkEditProps {
  match: match<{ searchId?: string }>;
  history: History;
}
interface BulkEditState {
  undoHistory: any[];
}
const getParsedSearchParams = searchParams => {
  const { q, aggFilters = [], crowdAggFilters = [] } = searchParams;
  const parsedSearchParams = {
    q: q ? JSON.parse(q) : {},
    aggFilters: aggFilters.map(omit(['__typename'])),
    crowdAggFilters: crowdAggFilters.map(omit(['__typename'])),
    page: 0,
  };
  return parsedSearchParams;
};

class BulkEditPage extends React.PureComponent<BulkEditProps, BulkEditState> {
  state = {
    undoHistory: [],
  };
  renderWorkflow(workflow: WorkflowConfigFragment | null) {
    const allowedSuggestedLabels = !workflow
      ? []
      : displayFields(
          workflow.suggestedLabelsFilter.kind,
          workflow.suggestedLabelsFilter.values,
          workflow.allSuggestedLabels.map(name => ({ name, rank: null }))
        ).map(prop('name'));

    const hash = new URLSearchParams(this.props.history.location.search)
      .getAll('hash')
      .toString() as string | null;
    console.log('HASH', hash);
    return (
      <Query query={SearchPageParamsQuery} variables={{ hash }}>
        {queryParams => {
          const searchParams = pathOr(
            {},
            ['data', 'searchParams'],
            queryParams
          ) as SearchPageParamsQuery_searchParams;
          const parsedSearchParams = getParsedSearchParams(searchParams);

          return (
            <Query
              query={LABELS_QUERY}
              variables={{
                searchHash: hash,
                params: { ...parsedSearchParams, agg: 'front_matter_keys' },
              }}>
              {({ data = {}, loading, error }) => {
                const { allCrowdAggs, myCrowdAggs } = data;
                const recordsTotal = pathOr(
                  0,
                  ['search', 'recordsTotal'],
                  data
                ) as number;
                let labels = uniq(
                  [
                    ...new Set([
                      ...extractBucketKeys(allCrowdAggs),
                      ...extractBucketKeys(myCrowdAggs),
                    ]),
                  ]
                    .filter(x => !FILTERED_LABELS.includes(x))
                    .filter(
                      x => !workflow || allowedSuggestedLabels.includes(x)
                    )
                );
                if (!labels.length) return null;
                //Band-aid fix to the -99999999 breaking BucketsForLabelQuery, does not like the name field as -9999999999
                labels.map((label, index) => {
                  if (label == -99999999999) {
                    labels[index] = '_missing';
                  }
                });
                return (
                  <Query
                    query={bucketsForLabels(labels)}
                    variables={variablesForLabels(labels, parsedSearchParams)}>
                    {({ data = {}, loading, error }) => {
                      if (error) {
                        console.log(error);
                        console.log(labels);
                      }
                      const aggBucketsByLabel = groupBucketsByLabel({
                        data,
                        labels,
                      });
                      // console.log('BUCKETS', { labels, aggBucketsByLabel });
                      return (
                        <Mutation mutation={BULK_LIST_UPDATE_MUTATION}>
                          {(bulkListUpdate, bulkListUpdateResult) => (
                            <Mutation mutation={BULK_QUERY_UPDATE_MUTATION}>
                              {(bulkQueryUpdate, { data, loading }) => (
                                <BulkEditView
                                  labels={labels}
                                  aggBucketsByLabel={aggBucketsByLabel}
                                  recordsTotal={recordsTotal}
                                  loading={loading}
                                  undoHistory={this.state.undoHistory}
                                  handleUndo={(undoActions, idx) => {
                                    bulkListUpdate({
                                      variables: {
                                        input: {
                                          updates: undoActions.map(a => ({
                                            ...omit(['__typename'], a),
                                            state: a.state.map(
                                              omit(['__typename'])
                                            ),
                                          })),
                                        },
                                      },
                                    }).then(() => {
                                      this.setState(state => ({
                                        undoHistory: state.undoHistory.filter(
                                          (x, i) => idx != i
                                        ),
                                      }));
                                    });
                                  }}
                                  commit={(toAdd, toRemove, description) => {
                                    return bulkQueryUpdate({
                                      variables: {
                                        input: {
                                          searchParams: {
                                            ...parsedSearchParams,
                                            pageSize: recordsTotal,
                                          },
                                          aggState: [
                                            ...toAdd.map(({ name, value }) => ({
                                              name,
                                              value,
                                              enable: true,
                                            })),
                                            ...toRemove.map(
                                              ({ name, value }) => ({
                                                name,
                                                value,
                                                enable: false,
                                              })
                                            ),
                                          ],
                                        },
                                      },
                                    }).then((result: any) => {
                                      this.setState(state => ({
                                        undoHistory: [
                                          ...state.undoHistory,
                                          {
                                            description,
                                            undoActions:
                                              result.data.bulkQueryUpdate
                                                .undoActions,
                                          },
                                        ],
                                      }));
                                    });
                                  }}
                                />
                              )}
                            </Mutation>
                          )}
                        </Mutation>
                      );
                    }}
                  </Query>
                );
              }}
            </Query>
          );
        }}
      </Query>
    );
  }
  render() {
    return (
      <WorkflowsViewProvider>
        {workflowsView => {
          const workflow = pipe(
            prop('workflows'),
            find(propEq('name', 'wf_bulk'))
          )(workflowsView) as WorkflowConfigFragment | null;
          return this.renderWorkflow(workflow);
        }}
      </WorkflowsViewProvider>
    );
  }
}

const FILTERED_LABELS = [
  'browse_condition_mesh_terms',
  'overall_status',
  'phase',
];

export default BulkEditPage;
