import 'regenerator-runtime/runtime'
import * as vega from 'vega';
// defines the VTP node type
import VegaTransformPostgres from 'vega-transform-db'
// import VegaTransformPostgres from './new_transform'
// includes the actual rewrite rules for the vega dataflow and translation to SQL
import { specRewrite } from '../vega-db/spec_rewrite'
import { view2dot } from '../vega-db/view2dot'
var hpccWasm = window['@hpcc-js/wasm'];
const querystring = require('querystring');
const http = require('http');
import { dataflowRewritePostgres } from '../vega-db/post_rewrite'
global.fetch = require('node-fetch');


export function run(spec: vega.Spec) {
  // (re-)run vega using the scalable vega version
  // FixMe: should we define these attributes in the spec somehow?
  const httpOptions = {
    'url': 'http://localhost:3000/query',
    'mode': 'cors',
    'method': 'POST',
    'headers': {
      //'Access-Control-Allow-Origin': '*',
      //'Content-Type': 'application/json'
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };

  (vega as any).transforms['dbtransform'] = VegaTransformPostgres;
  VegaTransformPostgres.setHttpOptions(httpOptions);

  loadOriginalSpec('original', spec, 'Original Specification');

  // make a vega execution object (runtime) from the spec
  const newspec = specRewrite(spec)
  console.log(newspec, 'rewrite');
  const newnewspec = {
    "$schema": "https://vega.github.io/schema/vega/v5.json",
    "width": 400,
    "height": 200,
    "padding": 10,
    "data": [

        {
            "name": "cars",
            
            "transform": [
                {
                  "type": "dbtransform",
                "query": {
                    "signal": "\"SELECT cylinders,AVG(miles_per_gallon) as miles_per_gallon       FROM cars       GROUP BY cylinders\""
                },
                "orig":{
                    "type": "aggregate",
                    "fields": [
                        "miles_per_gallon"
                    ],
                    "ops": [
                        "average"
                    ],
                    "as": [
                        "miles_per_gallon"
                    ],
                    "groupby": [
                        "cylinders"
                    ]
                  }
                }
            ]
        }
    ],
    "scales": [
        {
            "name": "xscale",
            "type": "band",
            "domain": {
                "data": "cars",
                "field": "cylinders"
            },
            "range": "width",
            "padding": 0.05,
            "round": true
        },
        {
            "name": "yscale",
            "domain": {
                "data": "cars",
                "field": "miles_per_gallon"
            },
            "nice": true,
            "range": "height"
        }
    ],
    "axes": [
        {
            "orient": "bottom",
            "scale": "xscale",
            "title": "Number of Cylinders"
        },
        {
            "orient": "left",
            "scale": "yscale",
            "title": "Miles per Gallon"
        }
    ],
    "marks": [
        {
            "type": "rect",
            "from": {
                "data": "cars"
            },
            "encode": {
                "enter": {
                    "x": {
                        "scale": "xscale",
                        "field": "cylinders"
                    },
                    "width": {
                        "scale": "xscale",
                        "band": 1
                    },
                    "y": {
                        "scale": "yscale",
                        "field": "miles_per_gallon"
                    },
                    "y2": {
                        "scale": "yscale",
                        "value": 0
                    }
                },
                "update": {
                    "fill": {
                        "value": "steelblue"
                    }
                }
            }
        }
    ]
}


  const runtime = vega.parse(newspec);
  console.log(runtime, 'runtime');

  // const runtime = vega.parse(spec)

  // bind the execution to a dom element as a view
  var view = new vega.View(runtime)
    .logLevel(vega.Info)
    .renderer('svg')
    .initialize(document.querySelector('#view'));

  // dataflowRewritePostgres(view)
  console.log(view, 'df');

  // execute the rewritten dataflow for the view
  view.runAsync();

  loadOriginalSpec('rewrite', spec.data, 'Rewritten Transforms With SQL');

  view.runAfter(view => {
    const dot = `${view2dot(view)}`
    hpccWasm.graphviz.layout(dot, 'svg', 'dot').then(svg => {
      const placeholder = document.getElementById('graph-placeholder');
      placeholder.innerHTML = svg;
    });
  })
  console.log(view)

  return view;
}

function loadOriginalSpec(id, spec, title) {

  const container = document.getElementById(id);
  // Insert original vega spec
  const ogSpecContainer = document.createElement('div');
  ogSpecContainer.id = id;
  const ogSpecCode = document.createElement('pre');
  ogSpecCode.classList.add('prettyprint');
  ogSpecCode.innerHTML = JSON.stringify(spec, null, 4);

  ogSpecContainer.innerHTML = `<h3>${title}</h3>`;
  ogSpecContainer.appendChild(ogSpecCode);
  container.parentNode.replaceChild(ogSpecContainer, container)
}

function handleVegaSpec() {
  // when a new spec is uploaded, re-run vega
  const reader = new FileReader();
  reader.onload = function (e: any) {
    const spec = JSON.parse(e.target.result);
    run(spec);


  };
  reader.readAsText(this.files[0]);
  (<HTMLInputElement>document.getElementById('vega-spec')).value = '';
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
  alert('Dataset ' + relationName + ' is being uploaded to the database');
}

function handleData() {
  // when a data file is uploaded, send it to the server and load into PostgreSQL
  const reader = new FileReader();
  let filename: string;
  reader.onload = function (e: any) {
    if (filename.slice(filename.length - '.json'.length) != '.json') {
      throw Error(`file ${filename} must have .json extension`);
    }
    const relationName = filename.slice(0, (filename.length - '.json.'.length) + 1).replace('-', '_');
    const data = JSON.parse(e.target.result);
    uploadSqlData(data, relationName);
  }
  filename = this.files[0].name;
  reader.readAsText(this.files[0]);
  (<HTMLInputElement>document.getElementById('data')).value = '';
}

function handleDemoData() {
  const cars_data = require('../../sample_data/data/cars.json');  
  uploadSqlData(cars_data, 'cars');
}


function handleDemoViz() {
  const cars_spec = [require('../../sample_data/specs/specs/cars_average_sourced.json'), require('../../sample_data/specs/specs/cars_count_transform_successor.json'), require('../../sample_data/specs/specs/cars_histogram_extent.json'), require('../../sample_data/specs/specs/cars_min_transform_successor.json'), require('../../sample_data/specs/specs/cars_missing_transform_successor.json'), require('../../sample_data/specs/specs/cars_q1_transform_successor.json'), require('../../sample_data/specs/specs/cars_stdev_transform_successor.json'), require('../../sample_data/specs/specs/cars_stdevp_transform_successor.json'), require('../../sample_data/specs/specs/cars_sum_transform_successor.json')]; 
  var temp = Math.floor(Math.random() * 9);
  const demo_spec = cars_spec[temp];
  run(demo_spec); 
}

document.getElementById('vega-spec').addEventListener('change', handleVegaSpec, false);
document.getElementById('data').addEventListener('change', handleData, false);
document.getElementById('demoviz').addEventListener('click', handleDemoViz);
document.getElementById('demodat').addEventListener('click', handleDemoData);
