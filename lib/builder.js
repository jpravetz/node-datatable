/*!
 * node-datatable
 * https://github.com/jpravetz/node-datatable
 * Copyright(c) 2012 Jim Pravetz <jpravetz@epdoc.com>
 * node-datatable may be freely distributed under the MIT license.
 */

var _u = require('underscore');

/**
 * Constructor
 * @param options Refer to README.md for a list of properties
 * @return {Object}
 */
module.exports = function( options ) {

    var self = {
        sTableName: options.sTableName,
        sCountColumnName: options.sCountColumnName,   // Name of column to use when counting total number of rows. Defaults to "id"
        sDatabase: options.sDatabase,           // If set, then do "USE useDatabase;" prior to query
        aoColumnDefs: options.aoColumnDefs,
        aSearchColumns: options.aSearchColumns,     // If specified then use instead of aoColumnDefs to determine names of columns to search
        sSelectSql: options.sSelectSql,           // alternate select statement
        sFromSql: options.sFromSql,           // alternate select statement
        sWhereAndSql: options.sWhereAndSql,           // Custom caller SQL, added as AND where to add date range or other checks (caller must write the SQL)
        sDateColumnName: options.sDateColumnName,   // If set then only get entries within the range (can use sWhereSql instead)
        dateFrom: options.dateFrom,                 // Only retrieve content from before this date. sDateColumnName must be set.
        dateTo: options.dateTo,                     // Only retrieve content from after this date. sDateColumnName must be set.
        fnRowFormatter: options.fnRowFormatter,
        oRowFormatterParams: options.oRowFormatterParams,
        oRequestQuery: options.oRequestQuery,           // Usually passed in with buildQuery

        queryMap: {},
        buildQuery: buildQuery,
        parseResponse: parseResponse,
        filteredResult: filteredResult
    };

    /**
     * (private) Build an optional "USE sDatabase" query string, if sDatabase is set.
     * @return {String} "USE sDatabase; " or "" if sDatabase is not set
     */
    function buildUseStatement() {
        return self.sDatabase ? ( "USE " + self.sDatabase + ";" ) : undefined;
    }

    /**
     * (private) Build the date partial that is used in a WHERE clause
     * @return {*}
     */
    function buildDatePartial() {
        if( self.sDateColumnName && self.dateFrom || self.dateTo ) {
            console.log( "DateFrom %s to %s", self.dateFrom, self.dateTo );
            if( self.dateFrom && self.dateTo ) {
                return self.sDateColumnName  + " BETWEEN '" + self.dateFrom.toISOString() + "' AND '" + self.dateTo.toISOString() + "'";
            } else if( self.dateFrom ) {
                return self.sDateColumnName  + " >= '" + self.dateFrom.toISOString() + "'";
            } else if( self.dateTo ) {
                return self.sDateColumnName  + " <= '" + self.dateTo.toISOString() + "'";
            }
        }
        return undefined;
    }

    /**
     * (private) Build a complete SELECT statement that counts the number of entries.
     * @param sSearchString If specified then produces a statement to count the filtered list of records.
     * Otherwise the statement counts the unfiltered list of records.
     * @return {String} A complete SELECT statement
     */
    function buildCountStatement(sSearchString) {
        var dateSql = buildDatePartial();
        var result = "SELECT COUNT(";
        result += self.sSelectSql ? "*" : (self.sCountColumnName?self.sCountColumnName:"id");
        result += ") FROM ";
        result += self.sFromSql ? self.sFromSql : self.sTableName;
        result += buildWherePartial( sSearchString );
//        var sSearchQuery = buildSearchPartial( sSearchString );
//        var sWheres = sSearchQuery ? [ sSearchQuery ] : [];
//        if( self.sWhereAndSql )
//            sWheres.push( self.sWhereAndSql )
//        if( dateSql )
//            sWheres.push( dateSql );
//        if( sWheres.length )
//            result += " WHERE (" + sWheres.join( ") AND (" ) + ")";
        return result + ";";
    }

    /**
     * (private) Build the WHERE clause
     * otherwise uses aoColumnDef mData property.
     * @param sSearchString
     * @return {String}
     */
    function buildWherePartial(sSearchString) {
        var sWheres = [];
        var sSearchQuery = buildSearchPartial( sSearchString );
        if( sSearchQuery )
            sWheres.push( sSearchQuery );
        if( self.sWhereAndSql )
            sWheres.push( self.sWhereAndSql );
        var dateSql = buildDatePartial();
        if( dateSql )
            sWheres.push( dateSql );
        if( sWheres.length )
            return " WHERE (" + sWheres.join( ") AND (" ) + ")";
        return "";
    }

    /**
     * (private)  Builds the search portion of the WHERE clause using LIKE.
     * Uses column names from the aSearchColumns, if defined, Otherwise uses
     * columns in aoColumnDefs that are marked with bSearchable true.
     * @param sSearchString The string for which we are to search
     * @return {String} A portion of a WHERE clause that does a search on all searchable row entries.
     */
    function buildSearchPartial(sSearchString) {
        var query = [];
        if( sSearchString ) {
            if( self.aSearchColumns ) {
                for( var sdx=0; sdx<self.aSearchColumns.length; ++sdx ) {
                    query.push( self.aSearchColumns[sdx] + " LIKE '%" + sSearchString + "%'" );
                }
            } else if( self.aoColumnDefs ) {
                for( var fdx=0; fdx<self.aoColumnDefs.length; ++fdx ) {
                    if( self.aoColumnDefs[fdx].bSearchable )
                        query.push( self.aoColumnDefs[fdx].mData + " LIKE '%" + sSearchString + "%'" );
                }
            }
        }
        return query.length ? query.join( " OR ") : undefined;
    }

    /**
     * (private) Adds an ORDER clause that uses the names of the columns in the aoColumnDefs array.
     * The column names are extracted from the column sOrder property, if present, otherwise from the mData property.
     * Note that sOrder is a custom Datatable property for the aoColumnDefs array. You might use sOrder if
     * your query were returning 8 columns that are then processed using fnRowFormatter to produce the number of
     * columns that you have defined in aoColumnDefs.
     * @param requestQuery The Datatable query string (we look at sort direction and sort columns)
     * @return {String} The ORDER clause
     */
    function buildOrderingPartial( requestQuery ) {
        var query = [];
        var iSortingCols = ( requestQuery && requestQuery.iSortingCols ) ? parseInt(requestQuery.iSortingCols) : 0;
        for( var fdx=0; fdx<iSortingCols; ++fdx ) {
            var key = "iSortCol_" + String(fdx);
            var value = requestQuery[key] ? parseInt(requestQuery[key]) : -1;
            if( value >= 0 && value < self.aoColumnDefs.length && requestQuery["bSortable_"+String(value)] === 'true' ) {
                var colName = self.aoColumnDefs[value].sOrder ? self.aoColumnDefs[value].sOrder : self.aoColumnDefs[value].mData;
                var str = colName + " " + requestQuery['sSortDir_'+String(fdx)].toUpperCase();
                query.push( str );
            }
        }
        if( query.length )
            return " ORDER BY " + query.join( ", " );
        return "";
    }

    /**
     * Build a LIMIT clause
     * @param requestQuery The Datatable query string (we look at iDisplayLength and iDisplayStart)
     * @return {String} The LIMIT clause
     */
    function buildLimitPartial( requestQuery ) {
        var sLimit = "";
        if( requestQuery && requestQuery.iDisplayStart !== undefined && requestQuery.iDisplayStart != -1 ) {
            sLimit = " LIMIT " + parseInt(requestQuery.iDisplayStart) + ", ";
            sLimit += (requestQuery.iDisplayLength && requestQuery.iDisplayLength>0) ? parseInt(requestQuery.iDisplayLength) : "100";
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
     * @return {Array} An array of query strings, each including a terminating semicolon.
     */
    function buildQuery( requestQuery ) {
        self.queryMap = {};
        var sSearch = sanitize(requestQuery.sSearch);
        self.oRequestQuery = requestQuery;
        var queries = [];
        var useStmt = buildUseStatement();
        if( useStmt ) {
            queries.push( useStmt );
            self.queryMap.use = queries.length - 1;
        }
        queries.push( buildCountStatement() );
        self.queryMap.iTotalRecords = queries.length - 1;
        if( sSearch ) {
            queries.push( buildCountStatement(sSearch) );
            self.queryMap.iTotalDisplayRecords = queries.length - 1;
        }
        var query = buildSelectPartial();
        query += buildWherePartial( sSearch );
        query += buildOrderingPartial( requestQuery );
        query += buildLimitPartial( requestQuery );
        query += ";"
        queries.push( query );
        self.queryMap.select = queries.length - 1;
        return queries;
    }

    /**
     * Parse the responses from the database and build a Datatable response object.
     * @param queryResult An array of SQL response objects, each of which must, in order, correspond with a query string
     * returned by buildQuery.
     * @return {Object} A Datatable reply that is suitable for sending in a response to the client.
     */
    function parseResponse( queryResult ) {
        var oQuery = self.oRequestQuery;
        var result = { iTotalDisplayRecords: 0, iTotalRecords: 0 };
        if( oQuery && oQuery.sEcho )
            result.sEcho = oQuery.sEcho;
        if( queryResult && queryResult.length > 1 ) {
            var objArray = queryResult[self.queryMap.select];
            var countObj = queryResult[self.queryMap.iTotalRecords];
            result.iTotalDisplayRecords = result.iTotalRecords = extractCount(countObj);
            if( self.queryMap.iTotalDisplayRecords ) {
                var displayCountObj = queryResult[self.queryMap.iTotalDisplayRecords];
                result.iTotalDisplayRecords = extractCount(displayCountObj);
            }
            var displayStart = ( oQuery && oQuery.iDisplayStart ) ? oQuery.iDisplayStart : 0;
            var displayLength = oQuery && oQuery.iDisplayLength ? oQuery.iDisplayLength : 10;
            displayLength = Math.min( displayLength, objArray.length );
            var displayEnd = displayStart + displayLength;
            result.aaData = [];
            console.log( "DisplayStart %d DisplayEnd %d DisplayLength %d", displayStart, displayEnd, displayLength );
            for( var rdx=0; rdx<displayLength; ++rdx ) {
                var filteredResult = [];
                // console.log("Index = %d", rdx);
//            filteredResult.DT_RowID = objArray[rdx]['id'];
//            filteredResult.DT_RowClass = "MyClass";
                if( self.fnRowFormatter ) {
                    filteredResult = self.fnRowFormatter( objArray[rdx], self.aoColumnDefs, self.oRowFormatterParams );
                } else {
                    for( var fdx=0; fdx<self.aoColumnDefs.length; ++fdx ) {
                        var key = self.aoColumnDefs[fdx].mData;
                        filteredResult.push( objArray[rdx][key]);
                        // filteredResult[fdx] = objArray[rdx][key];
                    }
                }
                result.aaData.push( filteredResult );
            }
        }
        return result;
    }

    /**
     * (private)
     * @param obj
     * @return {*}
     */
    function extractCount(obj) {
        var values;
        if( obj && obj.length )
            values = _u.values(obj[0]);
        if( values && values.length )
            return values[0];
        return 0;
    }

    /**
     * Debug, reduced size object for display
     * @param obj
     * @return {*}
     */
    function filteredResult(obj,count) {
        if( obj ) {
            var result = _u.omit( obj, "aaData" );
            result.aaLength = obj.aaData ? obj.aaData.length : 0;
            result.aaData = [];
            var count = count ? Math.min( count, result.aaLength ) : result.aaLength;
            for( var idx=0; idx<count; ++idx ) {
                result.aaData.push( obj.aaData[idx] );
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
function sanitize(str) {
    if( !str || str.length < 1 )
        return str;
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
                return "\\"+char; // prepends a backslash to backslash, percent,
            // and double/single quotes
        }
    });
}

/* Example datatable querystring = {
 "sEcho": "1",
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