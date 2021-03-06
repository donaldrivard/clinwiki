import * as React from 'react';
import { gql } from 'apollo-boost';
import { Mutation, MutationFn, MutationResult } from 'react-apollo';
import {
  CopySiteViewMutation as CopySiteViewMutationType,
  CopySiteViewMutationVariables,
} from 'types/CopySiteViewMutation';
import SiteProvider from '../containers/SiteProvider';

interface CopySiteViewMutationProps {
  children: (
    mutate: CopySiteViewMutationFn,
    result: MutationResult<CopySiteViewMutationType>
  ) => React.ReactNode;
  onCompleted?: (any) => void;
}

const COPY_SITE_VIEW_MUTATION = gql`
  mutation CopySiteViewMutation($input: CopySiteViewInput!) {
    copySiteView(input: $input) {
      siteView {
        ...SiteViewFragment
      }
      errors
    }
  }

  ${SiteProvider.siteViewFragment}
`;

class CopySiteViewMutationComponent extends Mutation<
  CopySiteViewMutationType,
  CopySiteViewMutationVariables
> {}
export type CopySiteViewMutationFn = MutationFn<
  CopySiteViewMutationType,
  CopySiteViewMutationVariables
>;

class CopySiteViewMutation extends React.PureComponent<
  CopySiteViewMutationProps
> {
  render() {
    return (
      <CopySiteViewMutationComponent mutation={COPY_SITE_VIEW_MUTATION}>
        {this.props.children}
      </CopySiteViewMutationComponent>
    );
  }
}

export default CopySiteViewMutation;
