import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';

const extensions = [json(), EditorView.lineWrapping];

type JsonEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  minHeight?: string;
  height?: string;
};

export function JsonEditor({ value, onChange, readOnly = false, minHeight = '200px', height }: JsonEditorProps) {
  return (
    <CodeMirror
      value={value}
      height={height}
      minHeight={minHeight}
      extensions={extensions}
      onChange={onChange}
      readOnly={readOnly}
      basicSetup={{ foldGutter: true, lineNumbers: true }}
    />
  );
}
