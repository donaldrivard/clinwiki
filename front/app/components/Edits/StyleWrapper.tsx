import * as React from "react";
import styled from 'styled-components';
import { Table } from 'react-bootstrap';

// these are the styles provided by diffy, btw
const StyleWrapper = styled(Table)`
  .diff {
    overflow: auto;
  }
  .diff ul {
    background: none;
    overflow: auto;
    font-size: 13px;
    list-style: none;
    margin: 0;
    padding: 0;
    display: table;
    width: 100%;
  }
  .diff del,
  .diff ins {
    display: block;
    text-decoration: none;
  }
  .diff li {
    padding: 0;
    display: table-row;
    margin: 0;
    height: 1em;
  }
  .diff li.ins {
    background: #dfd;
    color: #080;
  }
  .diff li.del {
    background: #fee;
    color: #b00;
  }
  .diff li:hover {
    background: #ffc;
  }
  /* try 'whitespace:pre;' if you don't want lines to wrap */
  .diff del,
  .diff ins,
  .diff span {
    white-space: pre-wrap;
    font-family: courier;
  }
  .diff del strong {
    font-weight: normal;
    background: #fcc;
  }
  .diff ins strong {
    font-weight: normal;
    background: #9f9;
  }
  .diff li.diff-comment {
    display: none;
  }
  .diff li.diff-block-info {
    background: none repeat scroll 0 0 gray;
  }
`;

export default StyleWrapper;
