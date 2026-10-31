import {validateProject, revisionId} from './project-history.js';

// Preserve the current editor buffer in drafts before switching to a new file.
export function withTestProgram(project, source, id = 'user_' + revisionId()) {
  validateProject(project);
  if (typeof source !== 'string' || !source.trim()) throw Error('Nie udało się odczytać kodu testowego.');
  if (Object.hasOwn(project.drafts || {}, id) || Object.hasOwn(project.trash || {}, id)) throw Error('Program o tym identyfikatorze już istnieje.');
  const oldId = project.currentExample || 'custom';
  return {
    ...project,
    currentExample: id,
    filename: 'FB_TestSCL.scl',
    code: source,
    drafts: {...project.drafts, [oldId]: project.code, [id]: source},
    projectFiles: {...project.projectFiles, [oldId]: project.filename || 'Program.scl', [id]: 'FB_TestSCL.scl'},
    watches: [],
    breakpoints: [],
  };
}
