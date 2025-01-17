/**
 * @module @ember-data/rest/request
 */
import { camelize } from '@ember/string';

import { pluralize } from 'ember-inflector';

import { buildBaseURL, buildQueryParams, type FindRecordUrlOptions } from '@ember-data/request-utils';
import type {
  ConstrainedRequestOptions,
  FindRecordRequestOptions,
  RemotelyAccessibleIdentifier,
} from '@ember-data/types/request';

import { copyForwardUrlOptions, extractCacheOptions } from './-utils';

type FindRecordOptions = ConstrainedRequestOptions & {
  include?: string | string[];
};

/**
 * Builds request options to fetch a single resource by a known id or identifier
 * configured for the url and header expectations of most REST APIs.
 *
 * **Basic Usage**
 *
 * ```ts
 * import { findRecord } from '@ember-data/rest/request';
 *
 * const data = await store.request(findRecord('person', '1'));
 * ```
 *
 * **With Options**
 *
 * ```ts
 * import { findRecord } from '@ember-data/rest/request';
 *
 * const options = findRecord('person', '1', { include: ['pets', 'friends'] });
 * const data = await store.request(options);
 * ```
 *
 * **With an Identifier**
 *
 * ```ts
 * import { findRecord } from '@ember-data/rest/request';
 *
 * const options = findRecord({ type: 'person', id: '1' }, { include: ['pets', 'friends'] });
 * const data = await store.request(options);
 * ```
 *
 * @method findRecord
 * @public
 * @static
 * @for @ember-data/rest/request
 * @param identifier
 * @param options
 */
export function findRecord(
  identifier: RemotelyAccessibleIdentifier,
  options?: FindRecordOptions
): FindRecordRequestOptions;
export function findRecord(type: string, id: string, options?: FindRecordOptions): FindRecordRequestOptions;
export function findRecord(
  arg1: string | RemotelyAccessibleIdentifier,
  arg2: string | FindRecordOptions | undefined,
  arg3?: FindRecordOptions
): FindRecordRequestOptions {
  const identifier: RemotelyAccessibleIdentifier = typeof arg1 === 'string' ? { type: arg1, id: arg2 as string } : arg1;
  const options = ((typeof arg1 === 'string' ? arg3 : arg2) || {}) as FindRecordOptions;
  const cacheOptions = extractCacheOptions(options);
  const urlOptions: FindRecordUrlOptions = {
    identifier,
    op: 'findRecord',
    resourcePath: pluralize(camelize(identifier.type)),
  };

  copyForwardUrlOptions(urlOptions, options);

  const url = buildBaseURL(urlOptions);
  const headers = new Headers();
  headers.append('Content-Type', 'application/json; charset=utf-8');

  return {
    url: options.include?.length
      ? `${url}?${buildQueryParams({ include: options.include }, options.urlParamsSettings)}`
      : url,
    method: 'GET',
    headers,
    cacheOptions,
    op: 'findRecord',
    records: [identifier],
  };
}
