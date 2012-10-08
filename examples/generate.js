/*!
 * generate
 * https://github.com/jpravetz/node-datatable
 * Copyright(c) 2012 Jim Pravetz <jpravetz@epdoc.com>
 * node-datatable may be freely distributed under the MIT license.
 */

var QueryBuilder = require('../index.js');

var oTableDef = {
    sTableName: "Orgs",
        aoColumnDefs: [
    { mData: "o", bSearchable: true },
    { mData: "cn", bSearchable: true },
    { mData: "support" },
    { mData: "email" }
]
};

var oDatatableParams = {
    iDisplayStart: 0,
    iDisplayLength: 4,
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
    "bSortable_3": "true"
};

generate( oTableDef, oDatatableParams );
oDatatableParams.sSearch = 'hello';
generate( oTableDef, oDatatableParams );
oDatatableParams.iSortCol_0 = 2;
oDatatableParams.sSortDir_0 = 'desc';
generate( oTableDef, oDatatableParams );
oDatatableParams.iDisplayStart = 30;
oDatatableParams.iDisplayLength = 15;
generate( oTableDef, oDatatableParams );

function generate( oTableDef, oDatatableParams ) {
    var queryBuilder = new QueryBuilder( oTableDef );
    var queries = queryBuilder.buildQuery( oDatatableParams );
    console.log( "Queries:\n  %s", queries.join("\n  ") );
}
