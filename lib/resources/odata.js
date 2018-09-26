// Copyright 2017 ODK Central Developers
// See the NOTICE file at the top-level directory of this distribution and at
// https://github.com/opendatakit/central-backend/blob/master/NOTICE.
// This file is part of ODK Central. It is subject to the license terms in
// the LICENSE file found in the top-level directory of this distribution and at
// https://www.apache.org/licenses/LICENSE-2.0. No part of ODK Central,
// including this file, may be copied, modified, propagated, or distributed
// except according to the terms contained in the LICENSE file.

const { getOrNotFound } = require('../util/promise');
const { contentType, xml, json } = require('../util/http');
const { odataEndpoint } = require('../http/endpoint');
const { serviceDocumentFor, edmxFor, rowStreamToOData, singleRowToOData } = require('../outbound/odata');

module.exports = (service, { Form, Submission, env }) => {
  const { domain } = env;

  // serves a service document comprising the primary dataset and any implicit
  // subtables created via repeats (section 11.1.1).
  service.get('/forms/:id.svc', odataEndpoint.json(({ auth, params, originalUrl }) =>
    Form.getByXmlFormId(params.id)
      .then(getOrNotFound)
      .then((form) => auth.canOrReject('read', form)
        .then(() => contentType('application/json; odata.metadata=minimal')(serviceDocumentFor(form, domain, originalUrl))))));

  // serves a metadata document describing the entities in this form
  // (section 11.1.2/CSDL). does not enforce json, since EDMX is the only
  // specification format.
  service.get('/forms/:id.svc/([$])metadata', odataEndpoint.xml(({ auth, params }) =>
    Form.getByXmlFormId(params.id)
      .then(getOrNotFound)
      .then((form) => auth.canOrReject('read', form)
        .then(() => xml(edmxFor(form))))));

  // serves filtered single-row data.
  service.get(/^\/forms\/([a-z0-9-_]+).svc\/Submissions\((?:'|%27)((?:uuid:)?[a-z0-9-]+)(?:'|%27)\)(\/.*)*$/i, odataEndpoint.json(({ auth, params, query, originalUrl }) =>
    Form.getByXmlFormId(params[0]) // first regexp match
      .then(getOrNotFound)
      .then((form) => auth.canOrReject('read', form)
        .then(() => Submission.getById(form.id, params[1], true)
          .then(getOrNotFound)
          .then((submission) => singleRowToOData(form, submission, domain, decodeURI(originalUrl), query))))));

  // helper for the next request which determines whether and how to apply the
  // given paging parameters; we page toplevel slices with the database but we
  // must get all rows if a subtable is requested.
  const pageOData = (params, query) => {
    if ((params.table === 'Submissions') && (query.$skip != null) && (query.$top != null))
      return { extended: true, offset: query.$skip, limit: query.$top };

    return { extended: true };
  };
  // serves table data.
  service.get('/forms/:id.svc/:table', odataEndpoint.json(({ auth, params, originalUrl, query }) =>
    Form.getByXmlFormId(params.id)
      .then(getOrNotFound)
      .then((form) => auth.canOrReject('read', form)
        .then(() => Submission.streamRowsByFormId(form.id, pageOData(params, query))
          .then((stream) => json(rowStreamToOData(form, params.table, domain, originalUrl, query, stream)))))));
};

