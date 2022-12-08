/**
  @module @ember-data/store
*/

import {
  DEBUG_CLIENT_ORIGINATED,
  DEBUG_IDENTIFIER_BUCKET,
} from '@ember-data/store/-private/utils/identifier-debug-consts';

import type { ExistingResourceObject, ResourceIdentifierObject } from './ember-data-json-api';

export type ResourceData = ResourceIdentifierObject | ExistingResourceObject;
export type IdentifierBucket = 'record';

export interface Identifier {
  lid: string;
  clientId?: string;
}

export interface ExistingRecordIdentifier extends Identifier {
  id: string;
  type: string;
}

export interface NewRecordIdentifier extends Identifier {
  id: string | null;
  type: string;
}

/**
 * An Identifier specific to a record which may or may not
 * be present in the cache.
 *
 * The absence of an `id` DOES NOT indicate that this
 * Identifier is for a new client-created record as it
 * may also indicate that it was generated for a secondary
 * index and the primary `id` index is not yet known.
 *
 * @internal
 */
export type RecordIdentifier = ExistingRecordIdentifier | NewRecordIdentifier;

/**
 * Used when an Identifier is known to be the stable version
 *
 * @internal
 */
export interface StableIdentifier extends Identifier {
  [DEBUG_IDENTIFIER_BUCKET]?: string;
}

/**
 * Used when a StableRecordIdentifier was not created locally as part
 * of a call to store.createRecord
 *
 * Distinguishing between this Identifier and one for a client created
 * record that was created with an ID is generally speaking not possible
 * at runtime, so anything with an ID typically narrows to this.
 *
 * @internal
 */
export interface StableExistingRecordIdentifier extends StableIdentifier {
  id: string;
  type: string;
  [DEBUG_CLIENT_ORIGINATED]?: boolean;
}
/**
 * Used when a StableRecordIdentifier was created locally
 * (by a call to store.createRecord).
 *
 * It is possible in rare circumstances to have a StableRecordIdentifier
 * that is not for a new record but does not have an ID. This would
 * happen if a user intentionally created one for use with a secondary-index
 * prior to the record having been fully loaded.
 *
 * @internal
 */
export interface StableNewRecordIdentifier extends StableIdentifier {
  id: string | null;
  type: string;
  [DEBUG_CLIENT_ORIGINATED]?: boolean;
}

/**
 * A referentially stable object with a unique string (lid) that can be used
 * as a reference to data in the cache.
 *
 * Every record instance has a unique identifier, and identifiers may refer
 * to data that has never been loaded (for instance, in an async relationship).
 *
 * @class StableRecordIdentifier
 * @public
 */

/**
 * A string representing a unique identity.
 *
 * @property {string} lid
 * @public
 */
/**
 * the primary resource `type` or `modelName` this identity belongs to.
 *
 * @property {string} type
 * @public
 */
/**
 * the primary id for the record this identity belongs to. `null`
 * if not yet assigned an id.
 *
 * @property {string | null} id
 * @public
 */
export type StableRecordIdentifier = StableExistingRecordIdentifier | StableNewRecordIdentifier;

/**
  Configures how unique identifier lid strings are generated by @ember-data/store.

  This configuration MUST occur prior to the store instance being created.

  Takes a method which can expect to receive various data as its first argument
  and the name of a bucket as its second argument. Currently the second
  argument will always be `record` data should conform to a `json-api`
  `Resource` interface, but will be the normalized json data for a single
  resource that has been given to the store.

  The method must return a unique (to at-least the given bucket) string identifier
  for the given data as a string to be used as the `lid` of an `Identifier` token.

  This method will only be called by either `getOrCreateRecordIdentifier` or
  `createIdentifierForNewRecord` when an identifier for the supplied data
  is not already known via `lid` or `type + id` combo and one needs to be
  generated or retrieved from a proprietary cache.

  `data` will be the same data argument provided to `getOrCreateRecordIdentifier`
  and in the `createIdentifierForNewRecord` case will be an object with
  only `type` as a key.

  ```ts
  import { setIdentifierGenerationMethod } from '@ember-data/store';

  export function initialize(applicationInstance) {
    // note how `count` here is now scoped to the application instance
    // for our generation method by being inside the closure provided
    // by the initialize function
    let count = 0;

    setIdentifierGenerationMethod((resource, bucket) => {
      return resource.lid || `my-key-${count++}`;
    });
  }

  export default {
    name: 'configure-ember-data-identifiers',
    initialize
  };
  ```

  @method setIdentifierGenerationMethod
  @for @ember-data/store
  @param method
  @public
  @static
*/
export type GenerationMethod = (data: ResourceData | { type: string }, bucket: IdentifierBucket) => string;

/**
 Configure a callback for when the identifier cache encounters new resource
 data for an existing resource.

 This configuration MUST occur prior to the store instance being created.

 ```js
 import { setIdentifierUpdateMethod } from '@ember-data/store';
 ```

 Takes a method which can expect to receive an existing `Identifier` alongside
 some new data to consider as a second argument. This is an opportunity
 for secondary lookup tables and caches associated with the identifier
 to be amended.

 This method is called everytime `updateRecordIdentifier` is called and
  with the same arguments. It provides the opportunity to update secondary
  lookup tables for existing identifiers.

 It will always be called after an identifier created with `createIdentifierForNewRecord`
  has been committed, or after an update to the `record` a `RecordIdentifier`
  is assigned to has been committed. Committed here meaning that the server
  has acknowledged the update (for instance after a call to `.save()`)

 If `id` has not previously existed, it will be assigned to the `Identifier`
  prior to this `UpdateMethod` being called; however, calls to the parent method
  `updateRecordIdentifier` that attempt to change the `id` or calling update
  without providing an `id` when one is missing will throw an error.

  @method setIdentifierUpdateMethod
  @for @ember-data/store
  @param method
  @public
  @static
*/

export type UpdateMethod = {
  (identifier: StableRecordIdentifier, newData: ResourceData, bucket: 'record'): void;
  (identifier: StableIdentifier, newData: unknown, bucket: never): void;
};

/**
 Configure a callback for when the identifier cache is going to release an identifier.

 This configuration MUST occur prior to the store instance being created.

 ```js
 import { setIdentifierForgetMethod } from '@ember-data/store';
 ```

 Takes method which can expect to receive an existing `Identifier` that should be eliminated
 from any secondary lookup tables or caches that the user has populated for it.

  @method setIdentifierForgetMethod
  @for @ember-data/store
  @param method
  @public
  @static
*/
export type ForgetMethod = (identifier: StableIdentifier | StableRecordIdentifier, bucket: IdentifierBucket) => void;

/**
 Configure a callback for when the identifier cache is being torn down.

 This configuration MUST occur prior to the store instance being created.

 ```js
 import { setIdentifierResetMethod } from '@ember-data/store';
 ```

 Takes a method which can expect to be called when the parent application is destroyed.

 If you have properly used a WeakMap to encapsulate the state of your customization
 to the application instance, you may not need to implement the `resetMethod`.

  @method setIdentifierResetMethod
  @for @ember-data/store
  @param method
  @public
  @static
*/
export type ResetMethod = () => void;
