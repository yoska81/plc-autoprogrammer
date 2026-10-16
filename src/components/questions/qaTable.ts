import type { DocTable } from '../../deliverables/docs/table';
import { makeTable } from '../../deliverables/docs/table';
import { answerText } from './qa';
import { SOURCE_LABEL, type Question } from './useQuestionStore';

/** Questions and answers as a document table (engineering package FDS, Excel specification). */
export function qaTable(questions: Question[]): DocTable {
  return makeTable([['No.', 5, 'center'], ['Question', 45], ['Answer', 45], ['Asked in', 14]],
    questions.map((q, i) => [String(i + 1), q.text, q.status === 'open' ? 'OPEN — to be answered' : answerText(q), SOURCE_LABEL[q.source]]));
}
