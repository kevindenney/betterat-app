jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));
jest.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// jest.mock() calls above must be hoisted before these imports; disable
// import/first so the mock declarations stay at the top of the file.
/* eslint-disable import/first */
import { supabase } from '../supabase';
import * as LibraryServiceModule from '../LibraryService';
import { mockSupabaseResponse } from '../../test/helpers/supabaseMock';
/* eslint-enable import/first */

const {
  getUserLibrary,
  deleteResource,
  markLessonCompleted,
  getResources,
} = LibraryServiceModule;

const fromMock = supabase.from as jest.Mock;

function chainBuilder(result: { data: any; error: any }) {
  const b: Record<string, any> = {};
  const chain = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'in', 'order', 'limit', 'range', 'filter',
  ];
  for (const m of chain) b[m] = jest.fn().mockReturnValue(b);
  b.single = jest.fn().mockResolvedValue(result);
  b.maybeSingle = jest.fn().mockResolvedValue(result);
  b.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return b;
}

describe('LibraryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserLibrary', () => {
    it('returns existing library if found', async () => {
      const existing = { id: 'lib-1', user_id: 'u1', interest_id: 'i1', name: 'My Library' };
      const builder = chainBuilder(mockSupabaseResponse(existing));
      fromMock.mockReturnValue(builder);

      const result = await getUserLibrary('u1', 'i1');

      expect(result).toEqual(existing);
      // Should not have called insert (auto-create path)
      expect(builder.insert).not.toHaveBeenCalled();
    });

    it('auto-creates library when none exists', async () => {
      // First call: maybeSingle returns null
      const findBuilder = chainBuilder(mockSupabaseResponse(null));
      // Second call: insert + single returns new library
      const created = { id: 'lib-new', user_id: 'u1', interest_id: 'i1', name: 'My Library' };
      const createBuilder = chainBuilder(mockSupabaseResponse(created));

      let callCount = 0;
      fromMock.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? findBuilder : createBuilder;
      });

      const result = await getUserLibrary('u1', 'i1');

      expect(result).toEqual(created);
      expect(createBuilder.insert).toHaveBeenCalledWith(
        // LibraryService is a compat shim over the renamed Playbook tables;
        // default library name is now "My Playbook".
        expect.objectContaining({ user_id: 'u1', interest_id: 'i1', name: 'My Playbook' }),
      );
    });
  });

  describe('markLessonCompleted', () => {
    it('appends lesson ID and sets last_completed_at', async () => {
      const existingMeta = {
        progress: { completed_lesson_ids: ['lesson-1'] },
        course_structure: { modules: [] },
      };

      // Fetch current metadata
      const fetchBuilder = chainBuilder(mockSupabaseResponse({ metadata: existingMeta }));
      // Update with merged metadata
      const updatedResource = {
        id: 'res-1',
        metadata: {
          ...existingMeta,
          progress: {
            completed_lesson_ids: ['lesson-1', 'lesson-2'],
            last_completed_at: expect.any(String),
          },
        },
      };
      const updateBuilder = chainBuilder(mockSupabaseResponse(updatedResource));

      let callCount = 0;
      fromMock.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? fetchBuilder : updateBuilder;
      });

      await markLessonCompleted('res-1', 'lesson-2');

      const updateArg = updateBuilder.update.mock.calls[0][0];
      expect(updateArg.metadata.progress.completed_lesson_ids).toContain('lesson-1');
      expect(updateArg.metadata.progress.completed_lesson_ids).toContain('lesson-2');
      expect(updateArg.metadata.progress.last_completed_at).toBeDefined();
    });

    it('prevents duplicate lesson IDs', async () => {
      const existingMeta = {
        progress: { completed_lesson_ids: ['lesson-1'] },
      };

      const fetchBuilder = chainBuilder(mockSupabaseResponse({ metadata: existingMeta }));
      const updateBuilder = chainBuilder(mockSupabaseResponse({ id: 'res-1' }));

      let callCount = 0;
      fromMock.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? fetchBuilder : updateBuilder;
      });

      await markLessonCompleted('res-1', 'lesson-1');

      const updateArg = updateBuilder.update.mock.calls[0][0];
      const ids = updateArg.metadata.progress.completed_lesson_ids;
      expect(ids.filter((id: string) => id === 'lesson-1')).toHaveLength(1);
    });
  });

  describe('getResources', () => {
    it('returns all resources when no filter is given', async () => {
      const resources = [{ id: 'r1' }, { id: 'r2' }];
      const builder = chainBuilder(mockSupabaseResponse(resources));
      fromMock.mockReturnValue(builder);

      const result = await getResources('lib-1');

      expect(result).toEqual(resources);
      // Column was renamed library_id → playbook_id; LibraryService is a shim.
      expect(builder.eq).toHaveBeenCalledWith('playbook_id', 'lib-1');
    });

    it('applies resource_type filter when provided', async () => {
      const resources = [{ id: 'r1', resource_type: 'book' }];
      const builder = chainBuilder(mockSupabaseResponse(resources));
      fromMock.mockReturnValue(builder);

      await getResources('lib-1', { resourceType: 'book' });

      // eq should be called for playbook_id AND resource_type
      const eqCalls = builder.eq.mock.calls;
      expect(eqCalls).toContainEqual(['playbook_id', 'lib-1']);
      expect(eqCalls).toContainEqual(['resource_type', 'book']);
    });
  });

  describe('deleteResource', () => {
    it('confirms the resource row was deleted', async () => {
      const builder = chainBuilder(mockSupabaseResponse({ id: 'res-1' }));
      fromMock.mockReturnValue(builder);

      await deleteResource('res-1');

      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('id', 'res-1');
      expect(builder.select).toHaveBeenCalledWith('id');
      expect(builder.maybeSingle).toHaveBeenCalled();
    });
  });
});
