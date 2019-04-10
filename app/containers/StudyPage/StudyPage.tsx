import * as React from 'react';
import { gql } from 'apollo-boost';
import styled from 'styled-components';
import { Nav, NavItem, Row, Col, Button } from 'react-bootstrap';
import { match, Route, Switch } from 'react-router-dom';
import { History, Location } from 'history';
import ReactStars from 'react-stars';
import {
  last,
  split,
  pipe,
  findIndex,
  propEq,
  sortBy,
  prop,
  map,
  isEmpty,
  reject,
  drop,
  join,
  equals,
} from 'ramda';
import { StudyPageQuery, StudyPageQueryVariables } from 'types/StudyPageQuery';
import {
  StudyPagePrefetchQuery,
  StudyPagePrefetchQueryVariables,
} from 'types/StudyPagePrefetchQuery';

import WikiPage from 'containers/WikiPage';
import CrowdPage from 'containers/CrowdPage';
import StudySummary from 'components/StudySummary';
import WikiToggle from 'components/WikiToggle';
import { Query } from 'react-apollo';
import { trimPath } from 'utils/helpers';
import ReviewsPage from 'containers/ReviewsPage';
import DescriptivePage from 'containers/DescriptivePage';
import AdministrativePage from 'containers/AdministrativePage';
import RecruitmentPage from 'containers/RecruitmentPage';
import InterventionsPage from 'containers/InterventionsPage';
import TrackingPage from 'containers/TrackingPage';
import SitesPage from 'containers/SitesPage';
import TagsPage from 'containers/TagsPage';

interface StudyPageProps {
  history: History;
  location: Location;
  match: match<{ nctId: string }>;
  prevLink?: string | null;
  nextLink?: string | null;
  isWorkflow?: boolean;
}

interface StudyPageState {
  // trigger prefetch for all study sections
  triggerPrefetch: boolean;
  wikiToggleValue: boolean;
}

const QUERY = gql`
  query StudyPageQuery($nctId: String!) {
    study(nctId: $nctId) {
      ...StudySummaryFragment
      nctId
    }
  }

  ${StudySummary.fragment}
`;

// Prefetch all sections for study
const PREFETCH_QUERY = gql`
  query StudyPagePrefetchQuery($nctId: String!) {
    study(nctId: $nctId) {
      ...StudySummaryFragment
      wikiPage {
        ...WikiPageFragment
        ...CrowdPageFragment
        ...TagsPageFragment
      }
      descriptiveInfo {
        ...DescriptiveInfoFragment
      }
      administrativeInfo {
        ...AdministrativeInfoFragment
      }
      recruitmentInfo {
        ...RecruitmentInfoFragment
      }
      reviews {
        ...ReviewsPageFragment
      }
      interventions {
        ...InterventionItemFragment
      }
      trackingInfo {
        ...TrackingInfoFragment
      }
      facilities {
        ...FacilityFragment
      }
      nctId
    }
    me {
      id
      email
      firstName
      lastName
      defaultQueryString
    }
  }

  ${StudySummary.fragment}
  ${WikiPage.fragment}
  ${CrowdPage.fragment}
  ${DescriptivePage.fragment}
  ${ReviewsPage.fragment}
  ${AdministrativePage.fragment}
  ${RecruitmentPage.fragment}
  ${InterventionsPage.fragment}
  ${TrackingPage.fragment}
  ${SitesPage.fragment}
  ${TagsPage.fragment}
`;

type Section = {
  name: string;
  path: string;
  order: number;
  component: React.Component;
};

const sections = [
  { name: 'Crowd', path: '/crowd', component: CrowdPage, order: 2 },
  { name: 'Reviews', path: '/reviews', component: ReviewsPage, order: 3 },
  {
    name: 'Descriptive',
    path: '/descriptive',
    component: DescriptivePage,
    order: 4,
  },
  {
    name: 'Administative',
    path: '/administrative',
    component: AdministrativePage,
    order: 5,
  },
  {
    name: 'Recruitment',
    path: '/recruitment',
    component: RecruitmentPage,
    order: 6,
  },
  {
    name: 'Interventions',
    path: '/interventions',
    component: InterventionsPage,
    order: 7,
  },
  { name: 'Tracking', path: '/tracking', component: TrackingPage, order: 8 },
  { name: 'Sites', path: '/sites', component: SitesPage, order: 9 },
  { name: 'Tags', path: '/tags', component: TagsPage, order: 10 },
  { name: 'Wiki', path: '/', component: WikiPage, order: 1 },
];

const StudyWrapper = styled.div``;
const ReviewsWrapper = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-right: 10px;
`;

class QueryComponent extends Query<StudyPageQuery, StudyPageQueryVariables> {}
class PrefetchQueryComponent extends Query<
  StudyPagePrefetchQuery,
  StudyPagePrefetchQueryVariables
> {}

class StudyPage extends React.Component<StudyPageProps, StudyPageState> {
  state: StudyPageState = {
    triggerPrefetch: false,
    wikiToggleValue: true,
  };

  getCurrentSectionPath = () => {
    const pathComponents = pipe(
      split('/'),
      reject(isEmpty),
      map(x => `/${x}`),
    )(trimPath(this.props.location.pathname)) as string[];

    for (const component of pathComponents) {
      if (findIndex(propEq('path', component), sections) >= 0) {
        return component;
      }
    }

    return '/';
  };

  getCurrentSectionFullPath = () => {
    const pathComponents = pipe(
      split('/'),
      reject(isEmpty),
      map(x => `/${x}`),
    )(trimPath(this.props.location.pathname)) as string[];

    for (const component of pathComponents) {
      if (findIndex(propEq('path', component), sections) >= 0) {
        const idx = findIndex(equals(component), pathComponents);
        return pipe(
          drop(idx),
          // @ts-ignore
          join(''),
        )(pathComponents);
      }
    }

    return '/';
  };

  handleSelect = (key: string) => {
    this.props.history.push(`${trimPath(this.props.match.url)}${key}`);
  };

  handleLoaded = () => {
    if (!this.state.triggerPrefetch) {
      this.setState({ triggerPrefetch: true });
    }
  };

  handleWikiToggleChange = () => {
    this.setState({ wikiToggleValue: !this.state.wikiToggleValue });
  };

  handleNavButtonClick = (link: string) => () => {
    this.props.history.push(
      `${trimPath(link)}${this.getCurrentSectionFullPath()}`,
    );
  };

  renderNavButton = (name: string, link?: string | null) => {
    if (link === undefined) return null;

    return (
      <Button
        style={{ marginRight: 10, marginBottom: 10 }}
        onClick={this.handleNavButtonClick(link!)}
        disabled={link === null}
      >
        {name}
      </Button>
    );
  };

  renderReviewsSummary = (data: StudyPageQuery | undefined) => {
    if (!data || !data.study) return null;
    return (
      <ReviewsWrapper>
        <div>
          <ReactStars
            count={5}
            half
            edit={false}
            value={data.study.averageRating}
          />
          <div>{`${data.study.reviewsCount} Reviews`}</div>
        </div>
      </ReviewsWrapper>
    );
  };

  render() {
    return (
      <QueryComponent
        query={QUERY}
        variables={{ nctId: this.props.match.params.nctId }}
        fetchPolicy="cache-only"
      >
        {({ data, loading, error }) => (
          <StudyWrapper>
            <Row>
              <Col md={2} id="study-sidebar">
                {this.renderReviewsSummary(data)}
                <WikiToggle
                  value={this.state.wikiToggleValue}
                  onChange={this.handleWikiToggleChange}
                />
                <Nav
                  bsStyle="pills"
                  stacked
                  activeKey={this.getCurrentSectionPath()}
                  onSelect={this.handleSelect}
                >
                  {sortBy(prop('order'), sections).map((section: Section) => (
                    <NavItem key={section.path} eventKey={section.path}>
                      {section.name}
                    </NavItem>
                  ))}
                </Nav>
              </Col>
              <Col md={10} id="study-main">
                <div className="container">
                  {this.renderNavButton('<< Previous', this.props.prevLink)}
                  {this.renderNavButton('Next >>', this.props.nextLink)}
                </div>

                {data && data.study && <StudySummary study={data.study} />}
                <div className="container">
                  <Switch>
                    {sections.map(section => (
                      <Route
                        key={section.path}
                        path={`${this.props.match.path}${section.path}`}
                        render={props => {
                          const Component = section.component;
                          return (
                            <Component
                              {...props}
                              onLoaded={this.handleLoaded}
                              isWorkflow={this.props.isWorkflow}
                              nextLink={this.props.nextLink}
                            />
                          );
                        }}
                      />
                    ))}
                  </Switch>
                </div>
              </Col>
            </Row>
            {this.state.triggerPrefetch && (
              <PrefetchQueryComponent
                query={PREFETCH_QUERY}
                variables={{ nctId: this.props.match.params.nctId }}
              >
                {() => null}
              </PrefetchQueryComponent>
            )}
          </StudyWrapper>
        )}
      </QueryComponent>
    );
  }
}

export default StudyPage;
