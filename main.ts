import 'regenerator-runtime/runtime'
import * as vega from "vega";
// defines the VTP node type
import { VegaDbTransform } from "./lib/dbtransform";
import VegaTransformPostgres from "vega-transform-pg"
// includes the actual rewrite rules for the vega dataflow and translation to SQL
import { specRewrite } from "./lib/spec_rewrite"

const querystring = require('querystring');
const http = require('http');

// register the new transform with vega

// Vega.transforms.duckdb = new VegaDbTransform({
//   id: "duckdb",
//   databaseTable: new TestDatabaseTable("cars")
// });

export function run(spec: vega.Spec) {
  // (re-)run vega using the scalable vega version
  // FixMe: should we define these attributes in the spec somehow?
  const httpOptions = {
    "hostname": "localhost",
    "port": 3000,
    "method": "POST",
    "path": "/query",
    "headers": {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  };
  // (vega as any).transforms["postgres"] = VegaTransformPostgres;
  // VegaTransformPostgres.setHttpOptions(httpOptions);
  (vega as any).transforms["dbtransform"] = new VegaDbTransform({ id: "dbtransform", httpOptions: httpOptions });


  // make a vega execution object (runtime) from the spec
  const newspec = specRewrite(spec)
  console.log(newspec, "rewrite");

  const runtime = vega.parse(newspec);
  console.log(runtime, "runtime");


  // bind the execution to a dom element as a view
  var view = new vega.View(runtime)
    .logLevel(vega.Info)
    .renderer("svg")
    .initialize(document.querySelector("#view"));

  console.log(view, "df");

  // rewrite the dataflow execution for the view
  //dataflowRewritePostgres(view);
  // execute the rewritten dataflow for the view
  view.runAsync();
  return view;
}

function handleVegaSpec() {
  // when a new spec is uploaded, re-run vega
  const reader = new FileReader();
  reader.onload = function (e: any) {
    const spec = JSON.parse(e.target.result);
    run(spec);
  };
  reader.readAsText(this.files[0]);
  (<HTMLInputElement>document.getElementById("vega-spec")).value = "";
}

function uploadSqlDataHelper(data: Object[], rowsPerChunk: number, startOffset: number, relationName: string) {
  // send the uploaded data in batches to the server
  const endOffset = Math.min(startOffset + rowsPerChunk, data.length);
  const chunk = data.slice(startOffset, endOffset);
  const postData = querystring.stringify({
    name: relationName,
    data: JSON.stringify(chunk)
  });
  const httpOptions = {
    hostname: 'localhost',
    port: 3000,
    method: 'POST',
    path: '/createSql',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    'Content-Length': Buffer.byteLength(postData)
  };
  const req = http.request(httpOptions, res => {
    let result = '';
    res.on('data', chunk => {
      result += chunk;
    });
    res.on('end', () => {
      if (res.statusCode === 400) {
        throw Error(`${res.statusMessage}: ${result}`);
      }
    });
  });
  req.write(postData);
  req.end();
  if (endOffset < data.length) {
    uploadSqlDataHelper(data, rowsPerChunk, endOffset, relationName);
  }
}

function uploadSqlData(data: Object[], relationName: string) {
  // when a new spec is uploaded, re-run vega
  const chunkBytes: number = 10 * 1024 * 1024; // 10MB
  const rowBytesSample: number = data.length > 0 ? JSON.stringify(data[0]).length : 1;
  const rowsPerChunk: number = Math.floor(chunkBytes / rowBytesSample);
  uploadSqlDataHelper(data, rowsPerChunk, 0, relationName);
}

function handleData() {
  // when a data file is uploaded, send it to the server and load into PostgreSQL
  const reader = new FileReader();
  let filename: string;
  reader.onload = function (e: any) {
    if (filename.slice(filename.length - '.json'.length) != '.json') {
      throw Error(`file ${filename} must have .json extension`);
    }
    const relationName = filename.slice(0, (filename.length - '.json.'.length) + 1).replace("-", "_");
    const data = JSON.parse(e.target.result);
    uploadSqlData(data, relationName);
  }
  filename = this.files[0].name;
  reader.readAsText(this.files[0]);
  (<HTMLInputElement>document.getElementById("data")).value = "";
}

document.getElementById("vega-spec").addEventListener("change", handleVegaSpec, false);
document.getElementById("data").addEventListener("change", handleData, false);
