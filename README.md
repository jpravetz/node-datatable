node-datatable
==============

Node.js implementation of a server-side processor for the JQuery Datatable plug-in.

This is version 0.0.3 of this module. You should be careful of relying on this implementation until it has been more
thoroughly reviewed.

The node-datatable module provides backend SQL query generation and result parsing to support
[datatable](http://datatables.net/usage/server-side) server-side processing for SQL databases.
This module does not connect nor query a database, instead leaving this task to the calling application.
SQL querying has been separated so that the caller can leverage his or her existing module choices for connection pools,
database interfaces, and the like. This module has been used with
both [node-mysql](https://github.com/felixge/node-mysql) and [sequelize](http://sequelizejs.com).

An incomplete code example:

```javascript
var QueryBuilder = require('datatable');

var tableDefinition = {
    sTableName: "Orgs",
    aoColumnDefs: [
        { mData: "o", bSearchable: true },
        { mData: "cn", bSearchable: true },
        { mData: "support" }
    ]};

var queryBuilder = new QueryBuilder( tableDefinition );

// requestQuery is normally provided by the datatable ajax call
var requestQuery = {
    iDisplayStart: 0,
    iDisplayLength: 5
};

// Build an array of SQL query statements
var queries = queryBuilder.buildQuery( requestQuery );

// Connect with and query the database.
// If you have turned on multipleStatements (e.g. node-mysql) then you may join the queries into one string.
// multipleStatements is normally turned off by default to prevent SQL injections.

var myDbObject = ...
myDbObject.query( queries, function( err, resultArray ) {
    var result = queryBuilder.parseResponse(resultArray);
    res.json(result)
});

```

## API ##

The source code contains additional comments that will help you understand this module.

### Constructor ###

Construct a QueryBuilder object.

#### Parameters ####

The node-datatable constructor takes an object parameter that has the following options. In the simplest case only the first
two options will be necessary.

- ```sTableName``` - The name of the table in the database where a JOIN is not used. If JOIN is used then set ```sSelectSql```.

- ```aoColumnDefs``` - An array of objects each containing ```mData``` and ```bSearchable``` properties.
The default value for ```bSearchable``` is false.

- ```sCountColumnName``` For simple queries this is the name of the column on which to do a SQL COUNT(). Defaults to ```id```.
For more complex queries, meaning when sSelectSql is set, ```*``` will be used.

- ```sDatabase``` - If set then will add a SQL _USE sDatabase_ statement as the first SQL query string to be
returned by ```buildQuery```.

- ```aSearchColumns``` - In database queries where JOIN is used, you may wish to specify an alternate array of column names
that the search string will be applied against. Example:

```javascript
aSearchColumns: [ "table3.username", "table1.timestamp", "table1.urlType", "table1.mimeType", "table1.url", "table2.description" ],
```

- ```sSelectSql``` - If set then this defines the columns that should be selected, otherwise ```*``` is used. This can be
used in combination with joins (see ```sFromSql```).

- ```sFromSql``` - If set then this is used as the FROM section for the SELECT statement. If not set then ```sTableName```
is used. Use this for more complex queries, for example when using JOIN. Example when using a double JOIN:

```javascript
"table1 LEFT JOIN table2 ON table1.errorId=table2.errorId LEFT JOIN table3 ON table1.sessionId=table3.sessionId"
```

- ```sWhereAndSql``` - Use this to specify an arbitrary custom SQL that you wish to AND with the generated WHERE clauses.

- ```sDateColumnName``` - If this property and one of ```dateFrom``` or ```dateTo``` is set, a date range WHERE clause
will be added to the SQL query. This should be set to the name of the datetime column that is to be used in the clause.

- ```dateFrom``` - If set then the query will filter for records greater then or equal to this date.

- ```dateTo``` - If set then the query will filter for records less then or equal to this date.

- ```fnRowFormatter``` - A row formatter function (more documentation below).

#### Returns #####

The query builder object.

Example:

```javascript
var queryBuilder = new QueryBuilder( {
    sTableName: 'user',
    aoColumnDefs: [
        { mData: 'username', bSearchable: true },
        { mData: 'email', bSearchable: true }
    ]});
```

### buildQuery ###

Builds an array containing between two and four SQL statements, in the following order:

1. _(Optional, if ```sDatabase``` is set)_ A USE statement that specifies which database to use.
2. _(Optional, if ```requestQuery.sSearch``` is set)_ A SELECT statement that counts the number of filtered entries.
This is used to calculate the ```iTotalDisplayRecords``` return value.
3. A SELECT statement that counts the total number of unfiltered entries in the database. This is used to calculate
the ```iTotalRecords``` return value.
4. A SELECT statement that returns the actual filtered records from the database. This will use LIMIT to limit the number
of entries returned.

Note that #2, #3 and #4 will include date filtering as well as any other filtering specified in ```sWhereAndSql```.

#### Parameters ####

- ```requestQuery```: An object containing the properties set by the client-side datatable library as defined in [Parameters sent to the server](http://datatables.net/usage/server-side).

#### Returns #####

The resultant array of query strings. The queries should be executed in order, and the result objects collected
into an equivalently ordered array that is later passed to the ```parseReponse``` function.

Example:

```javascript
var queries = queryBuilder.buildQuery( oRequestQuery );
```

### parseResponse ###

Parses an array of response objects that were received in response to each of the queries generated by the ```buildQuery``` function. The order of responses must correspond with the query order.

#### Parameters ####

- ```queryResult```: The ordered array of query response objects.

#### Returns #####

An object containing the properties defined in [Reply from the server](http://datatables.net/usage/server-side).

Example:

```javascript
var result = queryBuilder.parseResponse( queryResponseArray );
res.json(result);
```

## Database queries involving JOIN ##

Example using ```sSelectSql``` and ```sFromSql``` to create a JOIN query.

```javascript
{
  sSelectSql: "table3.username,table1.timestamp,urlType,mimeType,table1.table3Id,url,table2.code,table2.description",
  sFromSql: "table1 LEFT JOIN table2 ON table1.errorId=table2.errorId LEFT JOIN table3 ON table1.sessionId=table3.sessionId",
}
```

The response of a more complex database queries can result in more columns of data then is displayed in the
the browser table. The example below shows how six columns in a row of database response data are reduced to four columns.
In this example, the ```row.urlType``` and ```row.mimeType``` are reduced into one column, as are the ```row.url```, ```row.code```
and ```row.description```.

```javascript
fnRowFormatter: function( row, column ) {
    var result = [ row.username, dateutil.dateToSortableString(row.timestamp) ];
    result.push( urlTypeMap(row.urlType,row.mimeType) );
    var url = row.url ? decodeURI(row.url).replace( /https?:\/\//i, '') : "";
    if( row.code )
        url += "</br>" + row.code + ": " + row.description;
    result.push( url );
    return result;
}
```

## TODO ##

1. Add an additional parameter to allow more then the requested number of records to be returned. This can be used to reduce the
number of client-server calls (I think).
2. A more thorough SQL injection security review (volunteers?).

## References ##

[1](http://datatables.net/usage/server-side)

[2](http://datatables.net/forums/discussion/4214/solved-how-to-handle-large-datasets/p1)