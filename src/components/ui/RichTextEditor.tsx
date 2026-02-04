import React, { useRef, useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Link, Undo, Code } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

interface ToolbarButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ onClick, children, title, active, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`p-2 rounded transition-colors ${
      active 
        ? 'bg-blue-100 text-blue-600' 
        : 'hover:bg-slate-100 text-slate-700'
    } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    title={title}
  >
    {children}
  </button>
);

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  minHeight = '200px'
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCodeView, setIsCodeView] = useState(false); // HTML 코드 뷰 모드

  // Initialize editor with content (Only once or when switching modes)
  React.useEffect(() => {
    if (editorRef.current && !isInitialized) {
      if (!isCodeView) {
        editorRef.current.innerHTML = value;
      }
      setIsInitialized(true);
    }
  }, [value, isInitialized, isCodeView]);

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const toggleCodeView = () => {
    setIsCodeView(!isCodeView);
    setIsInitialized(false); // Re-initialize content when switching
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="border-b border-slate-200 p-2 flex flex-wrap gap-1 bg-slate-50">
        <ToolbarButton onClick={() => execCommand('undo')} title="실행 취소 (Undo)" disabled={isCodeView}>
          <Undo size={16} />
        </ToolbarButton>

        <div className="w-px bg-slate-300 mx-1" />

        <ToolbarButton onClick={() => execCommand('bold')} title="굵게 (Bold)" disabled={isCodeView}>
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('italic')} title="기울임 (Italic)" disabled={isCodeView}>
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('underline')} title="밑줄 (Underline)" disabled={isCodeView}>
          <Underline size={16} />
        </ToolbarButton>

        <div className="w-px bg-slate-300 mx-1" />

        <ToolbarButton onClick={() => execCommand('insertUnorderedList')} title="글머리 기호 (Bullet List)" disabled={isCodeView}>
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('insertOrderedList')} title="번호 매기기 (Numbered List)" disabled={isCodeView}>
          <ListOrdered size={16} />
        </ToolbarButton>

        <div className="w-px bg-slate-300 mx-1" />

        <ToolbarButton onClick={() => execCommand('justifyLeft')} title="왼쪽 정렬" disabled={isCodeView}>
          <AlignLeft size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('justifyCenter')} title="가운데 정렬" disabled={isCodeView}>
          <AlignCenter size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => execCommand('justifyRight')} title="오른쪽 정렬" disabled={isCodeView}>
          <AlignRight size={16} />
        </ToolbarButton>

        <div className="w-px bg-slate-300 mx-1" />

        <ToolbarButton
          onClick={() => {
            const url = prompt('링크 URL을 입력하세요:', 'https://');
            if (url) {
              execCommand('createLink', url);
            }
          }}
          title="링크 추가 (Insert Link)"
          disabled={isCodeView}
        >
          <Link size={16} />
        </ToolbarButton>

        <div className="flex-1" />
        
        {/* HTML Source Code Toggle */}
        <ToolbarButton 
          onClick={toggleCodeView} 
          title={isCodeView ? "에디터 모드로 전환" : "HTML 소스 보기"} 
          active={isCodeView}
        >
          <Code size={16} />
          <span className="ml-1 text-xs font-bold">HTML</span>
        </ToolbarButton>
      </div>

      {/* Editor Area */}
      {isCodeView ? (
        <textarea
          value={value}
          onChange={handleCodeChange}
          className="w-full p-4 outline-none min-h-[200px] font-mono text-sm bg-slate-50 text-slate-800 resize-y"
          style={{ minHeight }}
          placeholder="HTML 코드를 직접 입력하세요..."
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          className="p-4 outline-none min-h-[200px] prose prose-slate max-w-none"
          style={{ minHeight }}
          dangerouslySetInnerHTML={{ __html: value }}
          suppressContentEditableWarning
        />
      )}
    </div>
  );
};

export default RichTextEditor;
