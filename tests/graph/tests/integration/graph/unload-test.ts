import { module, test } from 'qunit';

import { setupTest } from 'ember-qunit';

import { graphFor } from '@ember-data/graph/-private';
import type { Graph } from '@ember-data/graph/-private/graph';
import BelongsToRelationship from '@ember-data/graph/-private/state/belongs-to';
import Model, { attr, belongsTo } from '@ember-data/model';
import type Store from '@ember-data/store';
import { StableRecordIdentifier } from '@ember-data/types/q/identifier';

module('Integration | Graph | Unload', function (hooks) {
  setupTest(hooks);

  let store: Store;
  let graph: Graph;
  hooks.beforeEach(function () {
    const { owner } = this;
    store = owner.lookup('service:store') as Store;
    graph = graphFor(store);
  });

  module('Randomized Chaos', function () {
    test('(sync relationships) can separately safely unload related identifiers from the graph', function (assert) {
      const { owner } = this;
      const { identifierCache } = store;
      class User extends Model {
        @attr declare name: string;
        @belongsTo('user', { async: false, inverse: 'bestFriend' }) declare bestFriend: User | null;
        @belongsTo('user', { async: false, inverse: null }) declare worstFriend: User | null;
      }
      owner.register('model:user', User);

      const identifier = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '1' });
      const identifier2 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '2' });
      const identifier3 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '3' });

      function permutation(order: StableRecordIdentifier[], unloadTogether: boolean) {
        store._join(() => {
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'bestFriend',
            value: { data: identifier2 },
          });
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'worstFriend',
            value: { data: identifier3 },
          });
        });

        const bestFriend = graph.get(identifier, 'bestFriend') as BelongsToRelationship;
        const bestFriend2 = graph.get(identifier2, 'bestFriend') as BelongsToRelationship;
        const worstFriend = graph.get(identifier, 'worstFriend') as BelongsToRelationship;

        assert.strictEqual(bestFriend.localState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend.remoteState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(worstFriend.localState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(worstFriend.remoteState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(bestFriend2.localState, identifier, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend2.remoteState, identifier, 'precond - bestFriend is set');

        if (unloadTogether) {
          store._join(() => {
            order.forEach((i) => graph.unload(i));
          });
        } else {
          order.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
        }
        assert.ok(
          true,
          `did not throw when unloading identifiers in ${order.map((i) => i.id).join(',')} order during ${
            unloadTogether ? 'same run' : 'separate runs'
          }`
        );
      }

      permutation([identifier, identifier2, identifier3], true);
      permutation([identifier, identifier3, identifier2], true);
      permutation([identifier2, identifier, identifier3], true);
      permutation([identifier2, identifier3, identifier], true);
      permutation([identifier3, identifier, identifier2], true);
      permutation([identifier3, identifier2, identifier], true);
      permutation([identifier, identifier2, identifier3], false);
      permutation([identifier, identifier3, identifier2], false);
      permutation([identifier2, identifier, identifier3], false);
      permutation([identifier2, identifier3, identifier], false);
      permutation([identifier3, identifier, identifier2], false);
      permutation([identifier3, identifier2, identifier], false);
    });

    test('(sync relationships) can separately safely unload related identifiers from the graph following a delete', function (assert) {
      const { owner } = this;
      const { identifierCache } = store;
      class User extends Model {
        @attr declare name: string;
        @belongsTo('user', { async: false, inverse: 'bestFriend' }) declare bestFriend: User | null;
        @belongsTo('user', { async: false, inverse: null }) declare worstFriend: User | null;
      }
      owner.register('model:user', User);

      const identifier = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '1' });
      const identifier2 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '2' });
      const identifier3 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '3' });

      function permutation(order: StableRecordIdentifier[], unloadTogether: boolean) {
        store._join(() => {
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'bestFriend',
            value: { data: identifier2 },
          });
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'worstFriend',
            value: { data: identifier3 },
          });
        });

        const bestFriend = graph.get(identifier, 'bestFriend') as BelongsToRelationship;
        const bestFriend2 = graph.get(identifier2, 'bestFriend') as BelongsToRelationship;
        const worstFriend = graph.get(identifier, 'worstFriend') as BelongsToRelationship;

        assert.strictEqual(bestFriend.localState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend.remoteState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(worstFriend.localState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(worstFriend.remoteState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(bestFriend2.localState, identifier, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend2.remoteState, identifier, 'precond - bestFriend is set');

        const first = order[0];
        const rest = order.slice(1);
        if (unloadTogether) {
          store._join(() => {
            graph.push({
              op: 'deleteRecord',
              record: first,
              isNew: false,
            });
            rest.forEach((i) => graph.unload(i));
          });
        } else {
          store._join(() => {
            graph.push({
              op: 'deleteRecord',
              record: first,
              isNew: false,
            });
          });
          rest.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
        }
        assert.ok(
          true,
          `did not throw when deleting ${first.id!} then unloading identifiers in ${rest
            .map((i) => i.id)
            .join(',')} order during ${unloadTogether ? 'same run' : 'separate runs'}`
        );
      }

      permutation([identifier, identifier2, identifier3], true);
      permutation([identifier, identifier3, identifier2], true);
      permutation([identifier2, identifier, identifier3], true);
      permutation([identifier2, identifier3, identifier], true);
      permutation([identifier3, identifier, identifier2], true);
      permutation([identifier3, identifier2, identifier], true);
      permutation([identifier, identifier2, identifier3], false);
      permutation([identifier, identifier3, identifier2], false);
      permutation([identifier2, identifier, identifier3], false);
      permutation([identifier2, identifier3, identifier], false);
      permutation([identifier3, identifier, identifier2], false);
      permutation([identifier3, identifier2, identifier], false);
    });

    test('(sync relationships) can separately safely unload related identifiers from the graph multiple times', function (assert) {
      const { owner } = this;
      const { identifierCache } = store;
      class User extends Model {
        @attr declare name: string;
        @belongsTo('user', { async: false, inverse: 'bestFriend' }) declare bestFriend: User | null;
        @belongsTo('user', { async: false, inverse: null }) declare worstFriend: User | null;
      }
      owner.register('model:user', User);

      const identifier = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '1' });
      const identifier2 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '2' });
      const identifier3 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '3' });

      function permutation(order: StableRecordIdentifier[], unloadTogether: boolean) {
        store._join(() => {
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'bestFriend',
            value: { data: identifier2 },
          });
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'worstFriend',
            value: { data: identifier3 },
          });
        });

        const bestFriend = graph.get(identifier, 'bestFriend') as BelongsToRelationship;
        const bestFriend2 = graph.get(identifier2, 'bestFriend') as BelongsToRelationship;
        const worstFriend = graph.get(identifier, 'worstFriend') as BelongsToRelationship;

        assert.strictEqual(bestFriend.localState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend.remoteState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(worstFriend.localState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(worstFriend.remoteState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(bestFriend2.localState, identifier, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend2.remoteState, identifier, 'precond - bestFriend is set');

        if (unloadTogether) {
          store._join(() => {
            order.forEach((i) => graph.unload(i));
            order.forEach((i) => graph.unload(i));
          });
        } else {
          order.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
          order.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
        }
        assert.ok(
          true,
          `did not throw when unloading identifiers in ${order.map((i) => i.id).join(',')} order during ${
            unloadTogether ? 'same run' : 'separate runs'
          }`
        );
      }

      permutation([identifier, identifier2, identifier3], true);
      permutation([identifier, identifier3, identifier2], true);
      permutation([identifier2, identifier, identifier3], true);
      permutation([identifier2, identifier3, identifier], true);
      permutation([identifier3, identifier, identifier2], true);
      permutation([identifier3, identifier2, identifier], true);
      permutation([identifier, identifier2, identifier3], false);
      permutation([identifier, identifier3, identifier2], false);
      permutation([identifier2, identifier, identifier3], false);
      permutation([identifier2, identifier3, identifier], false);
      permutation([identifier3, identifier, identifier2], false);
      permutation([identifier3, identifier2, identifier], false);
    });

    test('(sync relationships) can separately safely unload related identifiers from the graph following a delete multiple times', function (assert) {
      const { owner } = this;
      const { identifierCache } = store;
      class User extends Model {
        @attr declare name: string;
        @belongsTo('user', { async: false, inverse: 'bestFriend' }) declare bestFriend: User | null;
        @belongsTo('user', { async: false, inverse: null }) declare worstFriend: User | null;
      }
      owner.register('model:user', User);

      const identifier = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '1' });
      const identifier2 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '2' });
      const identifier3 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '3' });

      function permutation(order: StableRecordIdentifier[], unloadTogether: boolean) {
        store._join(() => {
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'bestFriend',
            value: { data: identifier2 },
          });
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'worstFriend',
            value: { data: identifier3 },
          });
        });

        const bestFriend = graph.get(identifier, 'bestFriend') as BelongsToRelationship;
        const bestFriend2 = graph.get(identifier2, 'bestFriend') as BelongsToRelationship;
        const worstFriend = graph.get(identifier, 'worstFriend') as BelongsToRelationship;

        assert.strictEqual(bestFriend.localState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend.remoteState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(worstFriend.localState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(worstFriend.remoteState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(bestFriend2.localState, identifier, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend2.remoteState, identifier, 'precond - bestFriend is set');

        const first = order[0];
        const rest = order.slice(1);
        if (unloadTogether) {
          store._join(() => {
            graph.push({
              op: 'deleteRecord',
              record: first,
              isNew: false,
            });
            rest.forEach((i) => graph.unload(i));
            order.forEach((i) => graph.unload(i));
          });
        } else {
          store._join(() => {
            graph.push({
              op: 'deleteRecord',
              record: first,
              isNew: false,
            });
          });
          rest.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
          order.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
        }
        assert.ok(
          true,
          `did not throw when deleting ${first.id!} then unloading identifiers in ${rest
            .map((i) => i.id)
            .join(',')} order during ${unloadTogether ? 'same run' : 'separate runs'}`
        );
      }

      permutation([identifier, identifier2, identifier3], true);
      permutation([identifier, identifier3, identifier2], true);
      permutation([identifier2, identifier, identifier3], true);
      permutation([identifier2, identifier3, identifier], true);
      permutation([identifier3, identifier, identifier2], true);
      permutation([identifier3, identifier2, identifier], true);
      permutation([identifier, identifier2, identifier3], false);
      permutation([identifier, identifier3, identifier2], false);
      permutation([identifier2, identifier, identifier3], false);
      permutation([identifier2, identifier3, identifier], false);
      permutation([identifier3, identifier, identifier2], false);
      permutation([identifier3, identifier2, identifier], false);
    });

    test('(Async relationships) can separately safely unload related identifiers from the graph', function (assert) {
      const { owner } = this;
      const { identifierCache } = store;
      class User extends Model {
        @attr declare name: string;
        @belongsTo('user', { async: true, inverse: 'bestFriend' }) declare bestFriend: User | null;
        @belongsTo('user', { async: true, inverse: null }) declare worstFriend: User | null;
      }
      owner.register('model:user', User);

      const identifier = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '1' });
      const identifier2 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '2' });
      const identifier3 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '3' });

      function permutation(order: StableRecordIdentifier[], unloadTogether: boolean) {
        store._join(() => {
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'bestFriend',
            value: { data: identifier2 },
          });
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'worstFriend',
            value: { data: identifier3 },
          });
        });

        const bestFriend = graph.get(identifier, 'bestFriend') as BelongsToRelationship;
        const bestFriend2 = graph.get(identifier2, 'bestFriend') as BelongsToRelationship;
        const worstFriend = graph.get(identifier, 'worstFriend') as BelongsToRelationship;

        assert.strictEqual(bestFriend.localState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend.remoteState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(worstFriend.localState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(worstFriend.remoteState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(bestFriend2.localState, identifier, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend2.remoteState, identifier, 'precond - bestFriend is set');

        if (unloadTogether) {
          store._join(() => {
            order.forEach((i) => graph.unload(i));
          });
        } else {
          order.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
        }
        assert.ok(
          true,
          `did not throw when unloading identifiers in ${order.map((i) => i.id).join(',')} order during ${
            unloadTogether ? 'same run' : 'separate runs'
          }`
        );
      }

      permutation([identifier, identifier2, identifier3], true);
      permutation([identifier, identifier3, identifier2], true);
      permutation([identifier2, identifier, identifier3], true);
      permutation([identifier2, identifier3, identifier], true);
      permutation([identifier3, identifier, identifier2], true);
      permutation([identifier3, identifier2, identifier], true);
      permutation([identifier, identifier2, identifier3], false);
      permutation([identifier, identifier3, identifier2], false);
      permutation([identifier2, identifier, identifier3], false);
      permutation([identifier2, identifier3, identifier], false);
      permutation([identifier3, identifier, identifier2], false);
      permutation([identifier3, identifier2, identifier], false);
    });

    test('(Async relationships) can separately safely unload related identifiers from the graph following a delete', function (assert) {
      const { owner } = this;
      const { identifierCache } = store;
      class User extends Model {
        @attr declare name: string;
        @belongsTo('user', { async: true, inverse: 'bestFriend' }) declare bestFriend: User | null;
        @belongsTo('user', { async: true, inverse: null }) declare worstFriend: User | null;
      }
      owner.register('model:user', User);

      const identifier = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '1' });
      const identifier2 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '2' });
      const identifier3 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '3' });

      function permutation(order: StableRecordIdentifier[], unloadTogether: boolean) {
        store._join(() => {
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'bestFriend',
            value: { data: identifier2 },
          });
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'worstFriend',
            value: { data: identifier3 },
          });
        });

        const bestFriend = graph.get(identifier, 'bestFriend') as BelongsToRelationship;
        const bestFriend2 = graph.get(identifier2, 'bestFriend') as BelongsToRelationship;
        const worstFriend = graph.get(identifier, 'worstFriend') as BelongsToRelationship;

        assert.strictEqual(bestFriend.localState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend.remoteState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(worstFriend.localState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(worstFriend.remoteState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(bestFriend2.localState, identifier, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend2.remoteState, identifier, 'precond - bestFriend is set');

        const first = order[0];
        const rest = order.slice(1);
        if (unloadTogether) {
          store._join(() => {
            graph.push({
              op: 'deleteRecord',
              record: first,
              isNew: false,
            });
            rest.forEach((i) => graph.unload(i));
          });
        } else {
          store._join(() => {
            graph.push({
              op: 'deleteRecord',
              record: first,
              isNew: false,
            });
          });
          rest.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
        }
        assert.ok(
          true,
          `did not throw when deleting ${first.id!} then unloading identifiers in ${rest
            .map((i) => i.id)
            .join(',')} order during ${unloadTogether ? 'same run' : 'separate runs'}`
        );
      }

      permutation([identifier, identifier2, identifier3], true);
      permutation([identifier, identifier3, identifier2], true);
      permutation([identifier2, identifier, identifier3], true);
      permutation([identifier2, identifier3, identifier], true);
      permutation([identifier3, identifier, identifier2], true);
      permutation([identifier3, identifier2, identifier], true);
      permutation([identifier, identifier2, identifier3], false);
      permutation([identifier, identifier3, identifier2], false);
      permutation([identifier2, identifier, identifier3], false);
      permutation([identifier2, identifier3, identifier], false);
      permutation([identifier3, identifier, identifier2], false);
      permutation([identifier3, identifier2, identifier], false);
    });

    test('(Async relationships) can separately safely unload related identifiers from the graph multiple times', function (assert) {
      const { owner } = this;
      const { identifierCache } = store;
      class User extends Model {
        @attr declare name: string;
        @belongsTo('user', { async: true, inverse: 'bestFriend' }) declare bestFriend: User | null;
        @belongsTo('user', { async: true, inverse: null }) declare worstFriend: User | null;
      }
      owner.register('model:user', User);

      const identifier = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '1' });
      const identifier2 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '2' });
      const identifier3 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '3' });

      function permutation(order: StableRecordIdentifier[], unloadTogether: boolean) {
        store._join(() => {
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'bestFriend',
            value: { data: identifier2 },
          });
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'worstFriend',
            value: { data: identifier3 },
          });
        });

        const bestFriend = graph.get(identifier, 'bestFriend') as BelongsToRelationship;
        const bestFriend2 = graph.get(identifier2, 'bestFriend') as BelongsToRelationship;
        const worstFriend = graph.get(identifier, 'worstFriend') as BelongsToRelationship;

        assert.strictEqual(bestFriend.localState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend.remoteState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(worstFriend.localState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(worstFriend.remoteState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(bestFriend2.localState, identifier, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend2.remoteState, identifier, 'precond - bestFriend is set');

        if (unloadTogether) {
          store._join(() => {
            order.forEach((i) => graph.unload(i));
            order.forEach((i) => graph.unload(i));
          });
        } else {
          order.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
          order.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
        }
        assert.ok(
          true,
          `did not throw when unloading identifiers in ${order.map((i) => i.id).join(',')} order during ${
            unloadTogether ? 'same run' : 'separate runs'
          }`
        );
      }

      permutation([identifier, identifier2, identifier3], true);
      permutation([identifier, identifier3, identifier2], true);
      permutation([identifier2, identifier, identifier3], true);
      permutation([identifier2, identifier3, identifier], true);
      permutation([identifier3, identifier, identifier2], true);
      permutation([identifier3, identifier2, identifier], true);
      permutation([identifier, identifier2, identifier3], false);
      permutation([identifier, identifier3, identifier2], false);
      permutation([identifier2, identifier, identifier3], false);
      permutation([identifier2, identifier3, identifier], false);
      permutation([identifier3, identifier, identifier2], false);
      permutation([identifier3, identifier2, identifier], false);
    });

    test('(Async relationships) can separately safely unload related identifiers from the graph following a delete multiple times', function (assert) {
      const { owner } = this;
      const { identifierCache } = store;
      class User extends Model {
        @attr declare name: string;
        @belongsTo('user', { async: true, inverse: 'bestFriend' }) declare bestFriend: User | null;
        @belongsTo('user', { async: true, inverse: null }) declare worstFriend: User | null;
      }
      owner.register('model:user', User);

      const identifier = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '1' });
      const identifier2 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '2' });
      const identifier3 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '3' });

      function permutation(order: StableRecordIdentifier[], unloadTogether: boolean) {
        store._join(() => {
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'bestFriend',
            value: { data: identifier2 },
          });
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'worstFriend',
            value: { data: identifier3 },
          });
        });

        const bestFriend = graph.get(identifier, 'bestFriend') as BelongsToRelationship;
        const bestFriend2 = graph.get(identifier2, 'bestFriend') as BelongsToRelationship;
        const worstFriend = graph.get(identifier, 'worstFriend') as BelongsToRelationship;

        assert.strictEqual(bestFriend.localState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend.remoteState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(worstFriend.localState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(worstFriend.remoteState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(bestFriend2.localState, identifier, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend2.remoteState, identifier, 'precond - bestFriend is set');

        const first = order[0];
        const rest = order.slice(1);
        if (unloadTogether) {
          store._join(() => {
            graph.push({
              op: 'deleteRecord',
              record: first,
              isNew: false,
            });
            rest.forEach((i) => graph.unload(i));
            order.forEach((i) => graph.unload(i));
          });
        } else {
          store._join(() => {
            graph.push({
              op: 'deleteRecord',
              record: first,
              isNew: false,
            });
          });
          rest.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
          order.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
        }
        assert.ok(
          true,
          `did not throw when deleting ${first.id!} then unloading identifiers in ${rest
            .map((i) => i.id)
            .join(',')} order during ${unloadTogether ? 'same run' : 'separate runs'}`
        );
      }

      permutation([identifier, identifier2, identifier3], true);
      permutation([identifier, identifier3, identifier2], true);
      permutation([identifier2, identifier, identifier3], true);
      permutation([identifier2, identifier3, identifier], true);
      permutation([identifier3, identifier, identifier2], true);
      permutation([identifier3, identifier2, identifier], true);
      permutation([identifier, identifier2, identifier3], false);
      permutation([identifier, identifier3, identifier2], false);
      permutation([identifier2, identifier, identifier3], false);
      permutation([identifier2, identifier3, identifier], false);
      permutation([identifier3, identifier, identifier2], false);
      permutation([identifier3, identifier2, identifier], false);
    });

    test('(Mixed relationships) can separately safely unload related identifiers from the graph', function (assert) {
      const { owner } = this;
      const { identifierCache } = store;
      class User extends Model {
        @attr declare name: string;
        @belongsTo('user', { async: false, inverse: 'bestFriend' }) declare bestFriend: User | null;
        @belongsTo('user', { async: true, inverse: null }) declare worstFriend: User | null;
      }
      owner.register('model:user', User);

      const identifier = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '1' });
      const identifier2 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '2' });
      const identifier3 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '3' });

      function permutation(order: StableRecordIdentifier[], unloadTogether: boolean) {
        store._join(() => {
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'bestFriend',
            value: { data: identifier2 },
          });
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'worstFriend',
            value: { data: identifier3 },
          });
        });

        const bestFriend = graph.get(identifier, 'bestFriend') as BelongsToRelationship;
        const bestFriend2 = graph.get(identifier2, 'bestFriend') as BelongsToRelationship;
        const worstFriend = graph.get(identifier, 'worstFriend') as BelongsToRelationship;

        assert.strictEqual(bestFriend.localState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend.remoteState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(worstFriend.localState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(worstFriend.remoteState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(bestFriend2.localState, identifier, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend2.remoteState, identifier, 'precond - bestFriend is set');

        if (unloadTogether) {
          store._join(() => {
            order.forEach((i) => graph.unload(i));
          });
        } else {
          order.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
        }
        assert.ok(
          true,
          `did not throw when unloading identifiers in ${order.map((i) => i.id).join(',')} order during ${
            unloadTogether ? 'same run' : 'separate runs'
          }`
        );
      }

      permutation([identifier, identifier2, identifier3], true);
      permutation([identifier, identifier3, identifier2], true);
      permutation([identifier2, identifier, identifier3], true);
      permutation([identifier2, identifier3, identifier], true);
      permutation([identifier3, identifier, identifier2], true);
      permutation([identifier3, identifier2, identifier], true);
      permutation([identifier, identifier2, identifier3], false);
      permutation([identifier, identifier3, identifier2], false);
      permutation([identifier2, identifier, identifier3], false);
      permutation([identifier2, identifier3, identifier], false);
      permutation([identifier3, identifier, identifier2], false);
      permutation([identifier3, identifier2, identifier], false);
    });

    test('(Mixed relationships) can separately safely unload related identifiers from the graph following a delete', function (assert) {
      const { owner } = this;
      const { identifierCache } = store;
      class User extends Model {
        @attr declare name: string;
        @belongsTo('user', { async: false, inverse: 'bestFriend' }) declare bestFriend: User | null;
        @belongsTo('user', { async: true, inverse: null }) declare worstFriend: User | null;
      }
      owner.register('model:user', User);

      const identifier = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '1' });
      const identifier2 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '2' });
      const identifier3 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '3' });

      function permutation(order: StableRecordIdentifier[], unloadTogether: boolean) {
        store._join(() => {
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'bestFriend',
            value: { data: identifier2 },
          });
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'worstFriend',
            value: { data: identifier3 },
          });
        });

        const bestFriend = graph.get(identifier, 'bestFriend') as BelongsToRelationship;
        const bestFriend2 = graph.get(identifier2, 'bestFriend') as BelongsToRelationship;
        const worstFriend = graph.get(identifier, 'worstFriend') as BelongsToRelationship;

        assert.strictEqual(bestFriend.localState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend.remoteState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(worstFriend.localState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(worstFriend.remoteState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(bestFriend2.localState, identifier, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend2.remoteState, identifier, 'precond - bestFriend is set');

        const first = order[0];
        const rest = order.slice(1);
        if (unloadTogether) {
          store._join(() => {
            graph.push({
              op: 'deleteRecord',
              record: first,
              isNew: false,
            });
            rest.forEach((i) => graph.unload(i));
          });
        } else {
          store._join(() => {
            graph.push({
              op: 'deleteRecord',
              record: first,
              isNew: false,
            });
          });
          rest.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
        }
        assert.ok(
          true,
          `did not throw when deleting ${first.id!} then unloading identifiers in ${rest
            .map((i) => i.id)
            .join(',')} order during ${unloadTogether ? 'same run' : 'separate runs'}`
        );
      }

      permutation([identifier, identifier2, identifier3], true);
      permutation([identifier, identifier3, identifier2], true);
      permutation([identifier2, identifier, identifier3], true);
      permutation([identifier2, identifier3, identifier], true);
      permutation([identifier3, identifier, identifier2], true);
      permutation([identifier3, identifier2, identifier], true);
      permutation([identifier, identifier2, identifier3], false);
      permutation([identifier, identifier3, identifier2], false);
      permutation([identifier2, identifier, identifier3], false);
      permutation([identifier2, identifier3, identifier], false);
      permutation([identifier3, identifier, identifier2], false);
      permutation([identifier3, identifier2, identifier], false);
    });

    test('(Mixed relationships) can separately safely unload related identifiers from the graph multiple times', function (assert) {
      const { owner } = this;
      const { identifierCache } = store;
      class User extends Model {
        @attr declare name: string;
        @belongsTo('user', { async: false, inverse: 'bestFriend' }) declare bestFriend: User | null;
        @belongsTo('user', { async: true, inverse: null }) declare worstFriend: User | null;
      }
      owner.register('model:user', User);

      const identifier = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '1' });
      const identifier2 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '2' });
      const identifier3 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '3' });

      function permutation(order: StableRecordIdentifier[], unloadTogether: boolean) {
        store._join(() => {
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'bestFriend',
            value: { data: identifier2 },
          });
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'worstFriend',
            value: { data: identifier3 },
          });
        });

        const bestFriend = graph.get(identifier, 'bestFriend') as BelongsToRelationship;
        const bestFriend2 = graph.get(identifier2, 'bestFriend') as BelongsToRelationship;
        const worstFriend = graph.get(identifier, 'worstFriend') as BelongsToRelationship;

        assert.strictEqual(bestFriend.localState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend.remoteState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(worstFriend.localState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(worstFriend.remoteState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(bestFriend2.localState, identifier, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend2.remoteState, identifier, 'precond - bestFriend is set');

        if (unloadTogether) {
          store._join(() => {
            order.forEach((i) => graph.unload(i));
            order.forEach((i) => graph.unload(i));
          });
        } else {
          order.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
          order.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
        }
        assert.ok(
          true,
          `did not throw when unloading identifiers in ${order.map((i) => i.id).join(',')} order during ${
            unloadTogether ? 'same run' : 'separate runs'
          }`
        );
      }

      permutation([identifier, identifier2, identifier3], true);
      permutation([identifier, identifier3, identifier2], true);
      permutation([identifier2, identifier, identifier3], true);
      permutation([identifier2, identifier3, identifier], true);
      permutation([identifier3, identifier, identifier2], true);
      permutation([identifier3, identifier2, identifier], true);
      permutation([identifier, identifier2, identifier3], false);
      permutation([identifier, identifier3, identifier2], false);
      permutation([identifier2, identifier, identifier3], false);
      permutation([identifier2, identifier3, identifier], false);
      permutation([identifier3, identifier, identifier2], false);
      permutation([identifier3, identifier2, identifier], false);
    });

    test('(Mixed relationships) can separately safely unload related identifiers from the graph following a delete multiple times', function (assert) {
      const { owner } = this;
      const { identifierCache } = store;
      class User extends Model {
        @attr declare name: string;
        @belongsTo('user', { async: false, inverse: 'bestFriend' }) declare bestFriend: User | null;
        @belongsTo('user', { async: true, inverse: null }) declare worstFriend: User | null;
      }
      owner.register('model:user', User);

      const identifier = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '1' });
      const identifier2 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '2' });
      const identifier3 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '3' });

      function permutation(order: StableRecordIdentifier[], unloadTogether: boolean) {
        store._join(() => {
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'bestFriend',
            value: { data: identifier2 },
          });
          graph.push({
            op: 'updateRelationship',
            record: identifier,
            field: 'worstFriend',
            value: { data: identifier3 },
          });
        });

        const bestFriend = graph.get(identifier, 'bestFriend') as BelongsToRelationship;
        const bestFriend2 = graph.get(identifier2, 'bestFriend') as BelongsToRelationship;
        const worstFriend = graph.get(identifier, 'worstFriend') as BelongsToRelationship;

        assert.strictEqual(bestFriend.localState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend.remoteState, identifier2, 'precond - bestFriend is set');
        assert.strictEqual(worstFriend.localState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(worstFriend.remoteState, identifier3, 'precond - worstFriend is set');
        assert.strictEqual(bestFriend2.localState, identifier, 'precond - bestFriend is set');
        assert.strictEqual(bestFriend2.remoteState, identifier, 'precond - bestFriend is set');

        const first = order[0];
        const rest = order.slice(1);
        if (unloadTogether) {
          store._join(() => {
            graph.push({
              op: 'deleteRecord',
              record: first,
              isNew: false,
            });
            rest.forEach((i) => graph.unload(i));
            order.forEach((i) => graph.unload(i));
          });
        } else {
          store._join(() => {
            graph.push({
              op: 'deleteRecord',
              record: first,
              isNew: false,
            });
          });
          rest.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
          order.forEach((i) => {
            store._join(() => {
              graph.unload(i);
            });
          });
        }
        assert.ok(
          true,
          `did not throw when deleting ${first.id!} then unloading identifiers in ${rest
            .map((i) => i.id)
            .join(',')} order during ${unloadTogether ? 'same run' : 'separate runs'}`
        );
      }

      permutation([identifier, identifier2, identifier3], true);
      permutation([identifier, identifier3, identifier2], true);
      permutation([identifier2, identifier, identifier3], true);
      permutation([identifier2, identifier3, identifier], true);
      permutation([identifier3, identifier, identifier2], true);
      permutation([identifier3, identifier2, identifier], true);
      permutation([identifier, identifier2, identifier3], false);
      permutation([identifier, identifier3, identifier2], false);
      permutation([identifier2, identifier, identifier3], false);
      permutation([identifier2, identifier3, identifier], false);
      permutation([identifier3, identifier, identifier2], false);
      permutation([identifier3, identifier2, identifier], false);
    });
  });

  module('Specific Scenarios', function () {
    test('Unload of a record with a deleted implicitly related record', function (assert) {
      const { owner } = this;
      const { identifierCache } = store;
      class User extends Model {
        @attr declare name: string;
        @belongsTo('user', { async: false, inverse: null }) declare bestFriend: User | null;
        @belongsTo('user', { async: true, inverse: null }) declare worstFriend: User | null;
      }
      owner.register('model:user', User);

      const identifier = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '1' });
      const identifier2 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '2' });
      const identifier3 = identifierCache.getOrCreateRecordIdentifier({ type: 'user', id: '3' });

      store._join(() => {
        graph.push({
          op: 'updateRelationship',
          record: identifier2,
          field: 'bestFriend',
          value: { data: identifier },
        });
        graph.push({
          op: 'updateRelationship',
          record: identifier3,
          field: 'worstFriend',
          value: { data: identifier },
        });
      });

      const bestFriend = graph.get(identifier, 'bestFriend') as BelongsToRelationship;
      const bestFriend2 = graph.get(identifier2, 'bestFriend') as BelongsToRelationship;
      const worstFriend3 = graph.get(identifier3, 'worstFriend') as BelongsToRelationship;

      assert.strictEqual(bestFriend2.localState, identifier, 'precond - bestFriend is set');
      assert.strictEqual(bestFriend2.remoteState, identifier, 'precond - bestFriend is set');
      assert.strictEqual(worstFriend3.localState, identifier, 'precond - worstFriend is set');
      assert.strictEqual(worstFriend3.remoteState, identifier, 'precond - worstFriend is set');
      assert.strictEqual(bestFriend.localState, null, 'precond - bestFriend is not set');
      assert.strictEqual(bestFriend.remoteState, null, 'precond - bestFriend is not set');

      store._join(() => {
        graph.push({
          op: 'deleteRecord',
          record: identifier2,
          isNew: false,
        });
        graph.push({
          op: 'deleteRecord',
          record: identifier3,
          isNew: false,
        });
      });

      store._join(() => {
        graph.unload(identifier);
      });

      assert.ok(true, 'did not throw when unloading identifier');
    });
  });
});
