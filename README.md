# VegaPlus

A demo of how to run Vega with a database. This is a fork of [this project](https://github.com/heavyairship/scalable-vega) by @heavyairship, which is a fork of [another project](https://github.com/vega/scalable-vega) by @domoritz.

## Workspace Packages
### vega-db
The primary Scalable Vega library component to be used in your application.

### demo
An interactive web demo of Scalable Vega components with examples of updating data and chart variables.

### server
The middleware server required for running the Scalable Vega code and interacting with the user chosen database.


## Pre-Requisite
1. Install and start PostgreSQL.
2. Create a PostgreSQL database named `scalable_vega`, e.g., `createdb scalable_vega`. You don't need to do anything if you want to use DuckDB.

## Installation
1. Run `git clone git@github.com:leibatt/scalable-vega.git`.
2. Run `yarn --frozen-lockfile` and `yarn build` to install scalable-vega library dependencies.
3. For using prepopulated database in demo, look at [additional notes](#additional-notes).

## Running Middleware Server
1. Run `yarn build:server` to install scalable-vega server dependencies.
2. Run `yarn start:server_pg` to start the application server with postgres, for DuckDB run `yarn start:server_duck`
2. All the config information for the databases and server (including user, password and ports to be used) is currently stored in the `./packages/server/duck_db.js`/`./packages/server/postgres_db.js` files and can be customized.

## Running the Web Demo
1. Make sure you have the [middleware server running](#running-middleware-server).
2. In another terminal window, run `cd /path/to/dev/repos/scalable-vega`.
3. Run `yarn build:app` to build dependencies for the demo/application UI.
4. Run `yarn start:app` to start the web server.
5. Open a browser tab to localhost:1234.
6. Upload the cars dataset from `./sample_data/data/cars.json` to the data input or click on the `Upload Demo Data` button.
7. After uploading a dataset to database, upload a cars vega spec from `./sample_data/data/specs/specs/` to the specs inputor click on the `Show me a Demo Spec` button and see the visualization.

## Running Unit Tests
1. Again make sure you have the [middleware server running](#running-middleware-server). 
2. In another terminal window, run `cd /path/to/dev/repos/scalable-vega`. 
3. The Unit Tests assume a prepopulated database, either do so by uploading data using the web demo or use the provided database (look at additional notes).
4. For running the unit tests:
    1. For PostgreSQL, `yarn test transform_pg`
    2. For DuckDB, `yarn test transform_duckdb`

## Additional Notes
1. Prepopulated Database, We have provided prepopulated databases and scripts for PostgreSQL and DuckDB in `./packages/server/database`
    1. For PostgreSQL, use a command like `psql dbname < infile`. For example, `psql postgresql://postgres@localhost/scalable_vega < ./packages/server/database/scalable_vega.sql`
    2. For DuckDB you can run `yarn start:duckdb-sample` which will populate a duckdb database file with 5 tables. You can customize the name of the db file being used by making changes in `./packages/server/server.js` and `./packages/server/database/duckdb_insertion.js`
2. If you face `Cannot find name 'expect'` type error while running tests
    1. Run `yarn add @types/jest -D`
