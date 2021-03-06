# frozen_string_literal: true

describe SearchService do
  before do
    # we ask for front matter every time the search service retrieves agg buckets...
    allow_any_instance_of(SearchService).to receive(:agg_buckets_for_field).and_return({})
  end

  describe "#search" do
    subject { described_class.new(params).search }

    let(:params) { { q: { "children" => [{ "children" => [], "key" => "foo" }], "key" => "AND" } } }

    it "sends a request to elasticsearch" do
      stub_request(:get, "#{Clinwiki::Application.config.es_url}/studies_test/_search")
        .with(
          body: hash_including("query" => {
            "bool" => {
              "must" => {
                "query_string": {
                  "query" => "(foo)",
                },
              },
              "filter" => [{ "bool" => { "must" => [] } }],
            },
          }),
        )
        .to_return(
          status: 200,
          body: file_fixture("search_service/default_response.json"),
          headers: { "Content-Type" => "application/json" },
        )
      subject
      expect(webmock_requests[0].body).to match_snapshot("default_query")
    end

    describe "using the AST" do
      let(:params) {
        {
          q: {
            "children" => [
              {
                "children" => [
                  { "key" => "or", "children" => [
                    { "key": "baz", "children" => [] },
                    { "key": "qux", "children" => [] },
                  ] }, {
                    "children" => [{
                      "key" => "or",
                      "children" => [{ "key": "zoom", "children" => [] }, { "key": "zag" }],
                    }],
                    "key" => "and",
                  }
                ],
                "key" => "AND",
              },
            ],
            "key" => "and",
          },
        }
      }

      it "knows how to build a query from the AST" do
        stub_request(:get, "#{Clinwiki::Application.config.es_url}/studies_test/_search")
          .with(
            body: hash_including("query" => { "bool" => { "must" => { "query_string": {
              "query" => "(((baz) OR (qux)) AND (((zoom) OR (zag))))",
            } }, "filter" => [{ "bool" => { "must" => [] } }] } }),
          )
          .to_return(
            status: 200,
            body: file_fixture("search_service/default_response.json"),
            headers: { "Content-Type" => "application/json" },
          )
        subject
        expect(webmock_requests[0].body).to match_snapshot("ast_query")
      end
    end

    describe "filtering" do
      describe "scalar agg filters" do
        let(:params) {
          {
            q: { "key" => "foo", "children" => [] },
            agg_filters: [{ field: "browse_condition_mesh_terms", values: ["Foo", "Bar"] }],
          }
        }

        it "filters by ags" do
          stub_request(:get, "#{Clinwiki::Application.config.es_url}/studies_test/_search")
            .to_return(
              status: 200,
              body: file_fixture("search_service/default_response.json"),
              headers: { "Content-Type" => "application/json" },
            )
          subject
          expect(webmock_requests[0].body).to match_snapshot("scalar_agg_filter_query")
        end
      end

      describe "range agg filters" do
        let(:params) {
          {
            q: { "key" => "foo", "children" => [] },
            agg_filters: [{ field: "start_date", gte: Date.new(2010, 1, 1), lte: Date.new(2020, 1, 1) }],
          }
        }

        it "filters by ags" do
          stub_request(:get, "#{Clinwiki::Application.config.es_url}/studies_test/_search")
            .to_return(
              status: 200,
              body: file_fixture("search_service/default_response.json"),
              headers: { "Content-Type" => "application/json" },
            )
          subject
          expect(webmock_requests[0].body).to match_snapshot("range_agg_filter_query")
        end
      end
    end
  end
end
