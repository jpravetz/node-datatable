2.0.0 / 2015-04-08
==================

  * Database 1.10.6 support:
  ** Deprecated ```fnRowFormatter``` and ```oRowFormatterParams``` (use DataTables callbacks instead).
  ** Deprecated ```aoColumnDefs``` (this information now comes from the DataTables AJAX request).
  * ```buildQuery``` now returns an object with ```use```, ```data```, ```recordsTotal```, and ```recordsFiltered keys```, and ```parseResponse``` consumes it.
  * Added Oracle support
  
1.1.2 / 2013-12-10
==================

  * Cast sEcho to int to prevent xss exploits

1.1.1 / 2013-09-02
==================

  * Fixed to use ```sAjaxDataProp``` in debug method

1.1.0 / 2013-08-22
==================

  * Added PostgreSQL support, courtesy Eric Chauty
  * Added ```sAjaxDataProp``` property to constructor options to allow result property name to be set (defaults to 'aaData')
  * Fixed issue where return was incorrectly limited when iDisplayLength is set to -1

1.0.2 / 2013-08-01
==================

  * Sanitize sort order to produce ASC or DESC

1.0.1 / 2013-02-01
==================

  * Do more thorough sanitization of input parameters

1.0.0 / 2013-01-25
==================

  * Bumped version to reflect stability. There were no changes from v0.0.6.

0.0.6 / 2012-10-14
==================

  * Commented out debug statements

0.0.5 / 2012-10-12
==================

  * Added oRowFormatterParams to fnRowFormatter function

0.0.4 / 2012-10-08
==================

  * Fix bug where LIMIT initial 0 not set if iDisplayStart is 0

0.0.1 / 2012-10-06
==================

  * Initial release