/*!
 * node-datatable
 * https://github.com/jpravetz/node-datatable
 * Copyright(c) 2012-2013 Jim Pravetz <jpravetz@epdoc.com>
 * node-datatable may be freely distributed under the MIT license.
 */

var _u = require('underscore');

var DEFAULT_LIMIT = 100;

/**
 * Constructor
 * @param options Refer to README.md for a list of properties
 * @return {Object}
 */
module.exports = function (options) {

    var self = {
        sTableName: options.sTableName,
        sCountColumnName: options.sCountColumnName,   // Name of column to use when counting total number of rows. Defaults to "id"
        sDatabaseOrSchema: options.sDatabaseOrSchema,     // Add a "USE" statement for MySQL / Postgres or "ALTER SESSION SET CURRENT_SCHEMA" statement for Oracle.
        aSearchColumns: options.aSearchColumns || [],     // Used to determine names of columns to search
        sSelectSql: options.sSelectSql,           // alternate select statement
        sFromSql: options.sFromSql,           // alternate select statement
        sWhereAndSql: options.sWhereAndSql,           // Custom caller SQL, added as AND where to add date range or other checks (caller must write the SQL)
        sDateColumnName: options.sDateColumnName,   // If set then only get entries within the range (can use sWhereSql instead)
        dateFrom: options.dateFrom,                 // Only retrieve content from before this date. sDateColumnName must be set.
        dateTo: options.dateTo,                     // Only retrieve content from after this date. sDateColumnName must be set.
        oRequestQuery: options.oRequestQuery,           // Usually passed in with buildQuery
        sAjaxDataProp: 'data',           // The name of the data prop to set on the return value

        dbType: options.dbType,                     // "postgres" or "oracle", defaults to MySQL syntax

        buildQuery: buildQuery,
        parseResponse: parseResponse,
        extractResponseVal: extractResponseVal,
        filteredResult: filteredResult
    };

    /**
     * (private) Build an optional "USE sDatabaseOrSchema" for MySQL / Postgres or
     * "ALTER SESSION SET CURRENT_SCHEMA = sDatabaseOrSchema" statement for Oracle if sDatabaseOrSchema is set.
     * @return {string|undefined} The SQL statement or undefined
     */
    function buildSetDatabaseOrSchemaStatement() {
        if (self.sDatabaseOrSchema){
            if (self.dbType === 'oracle'){
                return 'ALTER SESSION SET CURRENT_SCHEMA = ' + self.sDatabaseOrSchema;
            }
            else{
                return "USE " + self.sDatabaseOrSchema;
            }
        }
    }

    /**
     * (private) Build the date partial that is used in a WHERE clause
     * @return {*}
     */
    function buildDatePartial() {
        if (self.sDateColumnName && self.dateFrom || self.dateTo) {
            // console.log( "DateFrom %s to %s", self.dateFrom, self.dateTo );
            if (self.dateFrom && self.dateTo) {
                return self.sDateColumnName + " BETWEEN '" + self.dateFrom.toISOString() + "' AND '" + self.dateTo.toISOString() + "'";
            } else if (self.dateFrom) {
                return self.sDateColumnName + " >= '" + self.dateFrom.toISOString() + "'";
            } else if (self.dateTo) {
                return self.sDateColumnName + " <= '" + self.dateTo.toISOString() + "'";
            }
        }
        return undefined;
    }

    /**
     * (private) Build a complete SELECT statement that counts the number of entries.
     * @param searchString If specified then produces a statement to count the filtered list of records.
     * Otherwise the statement counts the unfiltered list of records.
     * @return {String} A complete SELECT statement
     */
    function buildCountStatement(requestQuery) {
        var dateSql = buildDatePartial();
        var result = "SELECT COUNT(";
        result += self.sSelectSql ? "*" : (self.sCountColumnName ? self.sCountColumnName : "id");
        result += ") FROM ";
        result += self.sFromSql ? self.sFromSql : self.sTableName;
        result += buildWherePartial(requestQuery);
//        var sSearchQuery = buildSearchPartial( sSearchString );
//        var sWheres = sSearchQuery ? [ sSearchQuery ] : [];
//        if( self.sWhereAndSql )
//            sWheres.push( self.sWhereAndSql )
//        if( dateSql )
//            sWheres.push( dateSql );
//        if( sWheres.length )
//            result += " WHERE (" + sWheres.join( ") AND (" ) + ")";
        return result;
    }

    /**
     * (private) Build the WHERE clause
     * otherwise uses aoColumnDef mData property.
     * @param searchString
     * @return {String}
     */
    function buildWherePartial(requestQuery) {
        var sWheres = [];
        var searchQuery = buildSearchPartial(requestQuery);
        if (searchQuery)
            sWheres.push(searchQuery);
        if (self.sWhereAndSql)
            sWheres.push(self.sWhereAndSql);
        var dateSql = buildDatePartial();
        if (dateSql)
            sWheres.push(dateSql);
        if (sWheres.length)
            return " WHERE (" + sWheres.join(") AND (") + ")";
        return "";
    }

    /**
     * (private)  Builds the search portion of the WHERE clause using LIKE (or ILIKE for PostgreSQL).
     * @param {Object} requestQuery The datatable parameters that are generated by the client
     * @return {String} A portion of a WHERE clause that does a search on all searchable row entries.
     */
    function buildSearchPartial(requestQuery) {
        var searches = [],
            colSearches = buildSearchArray(requestQuery),
            globalSearches = buildSearchArray(requestQuery, true);

        if (colSearches.length){
            searches.push('(' + colSearches.join(" AND ") + ')');
        }

        if (globalSearches.length){
            searches.push('(' + globalSearches.join(" OR ") + ')');
        }

        return searches.join(" AND ");
    }

    /**
     * (private) Builds an array of LIKE / ILIKE statements to be added to the WHERE clause
     * @param {Object} requestQuery The datatable parameters that are generated by the client
     * @param {*} [global] If truthy, build a global search array. If falsy, build a column search array
     * @returns {Array} An array of LIKE / ILIKE statements
     */
    function buildSearchArray(requestQuery, global) {
        var searchArray = [],
            customColumns = _u.isArray(self.aSearchColumns) && !_u.isEmpty(self.aSearchColumns) && global;

        _u.each(customColumns ? self.aSearchColumns : requestQuery.columns, function(column){
            if (customColumns || column.searchable === 'true'){
                var colName = sanitize(customColumns ? column : column.name),
                    searchVal = sanitize(global ? requestQuery.search.value : column.search.value);

                if (colName && searchVal){
                    searchArray.push(self.dbType === 'postgres' ?
                        buildILIKESearch(colName, searchVal) :
                        buildLIKESearch(colName, searchVal));
                }
            }
        });

        return searchArray;
    }

    /**
     * (private) Builds the search portion of the WHERE clause using ILIKE
     * @param {string} colName The column to search
     * @param {string} searchVal The value to search for
     * @returns {string} An ILIKE statement to be added to the where clause
     */
    function buildILIKESearch(colName, searchVal) {
        return "CAST(" + colName + " as text)" + " ILIKE '%" + searchVal + "%'";
    }

    /**
     * (private) Builds the search portion of the WHERE clause using LIKE
     * @param {string} colName The column to search
     * @param {string} searchVal The value to search for
     * @returns {string} A LIKE statement to be added to the where clause
     */
    function buildLIKESearch(colName, searchVal) {
        return colName + " LIKE '%" + searchVal + "%'";
    }

    /**
     * (private) Adds an ORDER clause
     * @param requestQuery The Datatable query string (we look at sort direction and sort columns)
     * @return {String} The ORDER clause
     */
    function buildOrderingPartial(requestQuery) {
        var query = [];
        for (var fdx = 0; fdx < requestQuery.order.length; ++fdx) {
            var order = requestQuery.order[fdx],
                column = requestQuery.columns[order.column];

            if (column.orderable === 'true' && column.name) {
                query.push(column.name + " " + order.dir);
            }
        }
        if (query.length)
            return " ORDER BY " + query.join(", ");
        return "";
    }

    /**
     * Build a LIMIT clause
     * @param requestQuery The Datatable query string (we look at length and start)
     * @return {String} The LIMIT clause
     */
    function buildLimitPartial(requestQuery) {
        var sLimit = "";
        if (requestQuery && requestQuery.start !== undefined && self.dbType !== 'oracle') {
            var start = parseInt(requestQuery.start, 10);
            if (start >= 0) {
                var len = parseInt(requestQuery.length, 10);
                sLimit = (self.dbType === 'postgres') ? " OFFSET " + String(start) + " LIMIT " : " LIMIT " + String(start) + ", ";
                sLimit += ( len > 0 ) ? String(len) : String(DEFAULT_LIMIT);
            }
        }
        return sLimit;
    }

    /**
     * Build the base SELECT statement.
     * @return {String} The SELECT partial
     */
    function buildSelectPartial() {
        var query = "SELECT ";
        query += self.sSelectSql ? self.sSelectSql : "*";
        query += " FROM ";
        query += self.sFromSql ? self.sFromSql : self.sTableName;
        return query;
    }

    /**
     * Build an array of query strings based on the Datatable parameters
     * @param requestQuery The datatable parameters that are generated by the client
     * @return {Object} An array of query strings, each including a terminating semicolon.
     */
    function buildQuery(requestQuery) {
        var queries = {};
        if (typeof requestQuery !== 'object')
            return queries;
        var searchString = sanitize(requestQuery.search.value);
        self.oRequestQuery = requestQuery;
        var useStmt = buildSetDatabaseOrSchemaStatement();
        if (useStmt) {
            queries.changeDatabaseOrSchema = useStmt;
        }
        queries.recordsTotal = buildCountStatement(requestQuery);
        if (searchString) {
            queries.recordsFiltered = buildCountStatement(requestQuery);
        }
        var query = buildSelectPartial();
        query += buildWherePartial(requestQuery);
        query += buildOrderingPartial(requestQuery);
        query += buildLimitPartial(requestQuery);
        if (self.dbType === 'oracle'){
            var start = parseInt(requestQuery.start, 10);
            var len = parseInt(requestQuery.length, 10);
            if (len >= 0 && start >= 0) {
                query = 'SELECT * FROM (SELECT a.*, ROWNUM rnum FROM (' + query + ') ';
                query += 'a)' + ' WHERE rnum BETWEEN ' + (start + 1) + ' AND ' + (start + len);
            }
        }
        queries.select = query;
        return queries;
    }

    /**
     * Parse the responses from the database and build a Datatable response object.
     * @param queryResult An array of SQL response objects, each of which must, in order, correspond with a query string
     * returned by buildQuery.
     * @return {Object} A Datatable reply that is suitable for sending in a response to the client.
     */
    function parseResponse(queryResult) {
        var oQuery = self.oRequestQuery;
        var result = { recordsFiltered: 0, recordsTotal: 0 };
        if (oQuery && typeof oQuery.draw === 'string') {
            // Cast for security reasons, as per http://datatables.net/usage/server-side
            result.draw = parseInt(oQuery.draw,10);
        } else {
            result.draw = 0;
        }
        if (_u.isObject(queryResult) && _u.keys(queryResult).length > 1) {
            result.recordsFiltered = result.recordsTotal = extractResponseVal(queryResult.recordsTotal) || 0;
            if (queryResult.recordsFiltered) {
                result.recordsFiltered = extractResponseVal(queryResult.recordsFiltered) || 0;
            }
            result.data = queryResult.select;
        }
        return result;
    }

    /**
     * (private) Extract the value from a database response
     * @param {Array} res A database response array
     * @return {*}
     */
    function extractResponseVal(res) {
        if (_u.isArray(res) && res.length && _u.isObject(res[0])) {
            var resObj = _u.values(res[0]);

            if (resObj.length) {
                return resObj[0];
            }
        }
    }

    /**
     * Debug, reduced size object for display
     * @param obj
     * @return {*}
     */
    function filteredResult(obj, count) {
        if (obj) {
            var result = _u.omit(obj, self.sAjaxDataProp );
            result.aaLength = obj[self.sAjaxDataProp] ? obj[self.sAjaxDataProp].length : 0;
            result[self.sAjaxDataProp] = [];
            var count = count ? Math.min(count, result.aaLength) : result.aaLength;
            for (var idx = 0; idx < count; ++idx) {
                result[self.sAjaxDataProp].push(obj[self.sAjaxDataProp][idx]);
            }
            return result;
        }
        return null;
    }

    return self;
}

/**
 * Sanitize to prevent SQL injections.
 * @param str
 * @return {*}
 */
function sanitize(str, len) {
    len = len || 256;
    if (!str || typeof str === 'string' && str.length < 1)
        return str;
    if (typeof str !== 'string' || str.length > len)
        return null;
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\" + char; // prepends a backslash to backslash, percent,
            // and double/single quotes
        }
    });
}

/* Example datatable querystring = {
 "draw": "1",
 "iColumns": "4",
 "sColumns": "",
 "iDisplayStart": "0",
 "iDisplayLength": "10",
 "mDataProp_0": "0",
 "mDataProp_1": "1",
 "mDataProp_2": "2",
 "mDataProp_3": "3",
 "sSearch": "",
 "bRegex": "false",
 "sSearch_0": "",
 "bRegex_0": "false",
 "bSearchable_0": "true",
 "sSearch_1": "",
 "bRegex_1": "false",
 "bSearchable_1": "true",
 "sSearch_2": "",
 "bRegex_2": "false",
 "bSearchable_2": "true",
 "sSearch_3": "",
 "bRegex_3": "false",
 "bSearchable_3": "true",
 "iSortCol_0": "0",
 "sSortDir_0": "asc",
 "iSortingCols": "1",
 "bSortable_0": "true",
 "bSortable_1": "true",
 "bSortable_2": "true",
 "bSortable_3": "true",
 "_": "1349495139702"
 }
 */