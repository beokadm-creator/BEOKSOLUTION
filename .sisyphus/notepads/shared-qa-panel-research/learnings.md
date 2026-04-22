# Research Findings: Safely Injecting Shared Q&A Panel Component

**Date**: 2026-04-22
**Context**: Shared Q&A tab to be injected into multiple existing badge UI screens

## Core Composition Patterns

### 1. Compound Components Pattern (Recommended)
**Sources**:
- [Building Reusable UI in React - Medium](https://medium.com/@wardkhaddour/building-reusable-ui-in-react-compound-components-render-props-and-api-design-5089b83976e1)
- [Advanced Guide on React Component Composition - Makers' Den](https://makersden.io/blog/guide-on-react-component-composition)

**Why it fits Q&A tab**:
- Parent owns state, children consume scoped state
- Implicit state sharing without prop drilling
- Flexible composition for different badge UI layouts
- Clear composition boundaries

**Implementation approach**:
```tsx
<QAPanel>
  <QAPanel.Tabs>
    <QAPanel.Tab id="questions">Questions</QAPanel.Tab>
    <QAPanel.Tab id="answers">Answers</QAPanel.Tab>
  </QAPanel.Tabs>
  <QAPanel.Content />
</QAPanel>
```

**Key principles**:
- State stays in parent (`QAPanel`)
- Children access via Context (`useQAContext()`)
- Each child has single responsibility
- Clear API surface through exported sub-components

### 2. Render Props Pattern (Alternative)
**Source**: [Building Reusable UI in React - Medium](https://medium.com/@wardkhaddour/building-reusable-ui-in-react-compound-components-render-props-and-api-design-5089b83976e1)

**When to use**: If you need more control over rendering logic than compound components provide

## Prop Contract Design

### Clear Prop Boundaries
**Sources**:
- [How to Make Reusable React Components (2026 Guide) – TheLinuxCode](https://thelinuxcode.com/how-to-make-reusable-react-components-a-practical-2026-guide/)
- [The Component Manifesto](https://lifeiscontent.net/blog-postings/the-component-manifesto/)

**Core principles**:
1. **Props as contracts, not configuration dumps**
   - Each prop should describe intent, not implementation
   - Prefer semantic props (`variant`, `size`) over styling props (`className`)

2. **Narrow responsibility**
   - Component does one job well
   - Clear "what I accept" and "what I guarantee"

3. **Stable inputs reduce re-renders**
   - Avoid requiring inline objects/callbacks
   - Design for IDs and primitives when possible
   - Use `React.memo()` with stable prop identities

**Example contract for Q&A panel**:
```tsx
interface QAPanelProps {
  // Configuration props (stable)
  questionId: string
  defaultTab?: 'questions' | 'answers'
  readonly?: boolean

  // Content props (children)
  children: ReactNode

  // Event callbacks (stable with useCallback)
  onQuestionSubmit?: (question: string) => void
  onTabChange?: (tab: string) => void
}
```

### Controlled vs Uncontrolled
**Source**: [Sharing State Between Components - React](https://react.dev/learn/sharing-state-between-components)

**Decision matrix for Q&A panel**:
- **Controlled**: Tab state (parent owns active tab)
- **Uncontrolled**: Internal UI state (loading, error, form input)

**Rationale**: Tab state needs coordination with parent badge UI, but internal Q&A logic should be self-contained.

## State Isolation Strategies

### 1. Local State for Component-Internal Logic
**Sources**:
- [Sharing State Between Components - React](https://react.dev/learn/sharing-state-between-components)
- [How to Type React Props, State, and Hooks with TypeScript](https://oneuptime.com/blog/post/2026-01-15-type-react-props-state-hooks-typescript/view)

**What to keep local**:
- Loading states
- Form inputs
- Error states
- UI toggles (expand/collapse)

**Implementation**:
```tsx
function QAPanel({ questionId, onQuestionSubmit }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Local state doesn't leak to parent
  // Parent only knows about final outcomes via callbacks
}
```

### 2. Lifted State for Cross-Component Coordination
**When to lift**: When parent badge UI needs to know about Q&A panel state

**Example**: Active tab synchronization across multiple panels
```tsx
// Parent component
function BadgeUI() {
  const [activeTab, setActiveTab] = useState('info')
  // This state coordinates multiple child panels
}
```

### 3. Context for Compound Component State Sharing
**Source**: [How to Type React Props, State, and Hooks with TypeScript](https://oneuptime.com/blog/post/2026-01-15-type-react-props-state-hooks-typescript/view)

**Implementation pattern**:
```tsx
const QAContext = createContext<QAContextType | undefined>(undefined)

function useQAContext() {
  const context = useContext(QAContext)
  if (!context) {
    throw new Error('QA components must be used within QAPanel')
  }
  return context
}
```

**Benefits**:
- Encapsulates state within component tree
- Prevents accidental coupling
- Clear error if used outside boundary

## Minimizing Regression Risk

### 1. Test-First Approach
**Sources**:
- [AI-Assisted Frontend: Safely Refactoring React Components - DEV.to](https://dev.to/kowshik_jallipalli_a7e0a5/ai-assisted-frontend-safely-refactoring-react-components-with-code-agents-213d)
- [Refactoring Without Breaking Everything — Webcoderspeed](https://webcoderspeed.com/blog/scaling/refactoring-without-breaking-everything)

**Critical tests before injecting Q&A panel**:
1. **Characterization tests** for existing badge UI behavior
2. **Visual regression tests** to catch layout breaks
3. **Integration tests** for Q&A panel interactions
4. **Contract tests** verifying prop interface stability

**Testing strategy**:
```bash
# 1. Capture current behavior
npm test -- --listTests  # Identify existing tests
npx playwright test     # Visual baseline

# 2. Add Q&A panel tests
npx jest --testPathPattern=QAPanel

# 3. Verify no regressions
npm test
npm run test:e2e
```

### 2. Incremental Integration
**Sources**:
- [Refactoring Without Breaking Everything — Webcoderspeed](https://webcoderspeed.com/blog/scaling/refactoring-without-breaking-everything)
- [How to Migrate React UIs Without Breaking Everything - Hashbyt](https://hashbyt.com/blog/migrate-react-uis)

**Strangler Fig Pattern for Q&A panel**:
1. **Phase 1**: Add Q&A panel to ONE badge UI as feature flag
2. **Phase 2**: Verify tests pass, no layout breaks
3. **Phase 3**: Gradually roll out to other badge UIs
4. **Phase 4**: Remove feature flag once stable

**Implementation**:
```tsx
// Feature flag approach
const enableQAPanel = confId.includes('qa-enabled')

{enableQAPanel && <QAPanel questionId={questionId} />}
```

### 3. Safe Refactoring Checklist
**Source**: [Refactoring Without Breaking Everything — Webcoderspeed](https://webcoderspeed.com/blog/scaling/refactoring-without-breaking-everything)

**Pre-injection checklist**:
- [ ] All existing tests pass (characterization tests)
- [ ] Visual baseline captured (Playwright screenshots)
- [ ] Q&A panel has unit tests (80%+ coverage)
- [ ] Prop interface documented and typed
- [ ] Feature flag in place for gradual rollout
- [ ] Rollback plan documented

**Post-injection verification**:
- [ ] All existing tests still pass
- [ ] Visual regression tests pass
- [ ] No console errors/warnings
- [ ] Performance impact measured (Lighthouse)
- [ ] Accessibility audit passed (keyboard navigation)

### 4. Component Boundaries as Defense
**Source**: [The Component Manifesto](https://lifeiscontent.net/blog-postings/the-component-manifesto/)

**Clear boundaries prevent regression**:
```tsx
// ✅ Clear boundary - Q&A panel is self-contained
<QAPanel questionId={questionId} />

// ❌ Leaky boundary - Q&A panel reaches into parent state
<QAPanel
  questionId={questionId}
  parentState={parentState}  // DON'T DO THIS
  onParentUpdate={...}       // DON'T DO THIS
/>
```

## Recommended Implementation Approach

### Step 1: Design Prop Contract
1. Define clear props interface in TypeScript
2. Document each prop's purpose and type
3. Mark required vs optional props
4. Include JSDoc examples

### Step 2: Build with Compound Components
1. Create `QAPanel` parent with Context
2. Build `QAPanel.Tabs`, `QAPanel.Tab`, `QAPanel.Content` as children
3. Keep state internal to `QAPanel`
4. Expose only necessary callbacks

### Step 3: Isolate State
1. Use local state for loading, errors, form inputs
2. Lift only tab state to parent if coordination needed
3. Use Context for compound component state sharing
4. Avoid prop drilling through layers

### Step 4: Test First
1. Write unit tests for Q&A panel logic
2. Add integration tests for user flows
3. Capture visual baseline of target badge UIs
4. Add characterization tests for existing behavior

### Step 5: Incremental Rollout
1. Add feature flag for Q&A panel
2. Deploy to ONE badge UI first
3. Verify tests pass, no regressions
4. Gradually enable for other badge UIs
5. Remove feature flag once stable

## Anti-Patterns to Avoid

1. **Prop drilling through multiple layers** → Use Context instead
2. **Tight coupling to parent state** → Keep component self-contained
3. **Mutable props** → Always treat props as read-only
4. **Inline object props on every render** → Use useMemo, useCallback
5. **Large refactor without tests** → Test-first, small steps
6. **Breaking prop interface** → Add new props, deprecate old ones gradually

## Key References

- **Compound Components**: [Medium - Building Reusable UI in React](https://medium.com/@wardkhaddour/building-reusable-ui-in-react-compound-components-render-props-and-api-design-5089b83976e1)
- **Prop Contracts**: [TheLinuxCode - How to Make Reusable React Components (2026)](https://thelinuxcode.com/how-to-make-reusable-react-components-a-practical-2026-guide/)
- **State Isolation**: [React.dev - Sharing State Between Components](https://react.dev/learn/sharing-state-between-components)
- **Safe Refactoring**: [Webcoderspeed - Refactoring Without Breaking Everything](https://webcoderspeed.com/blog/scaling/refactoring-without-breaking-everything)
- **Test-First**: [DEV.to - AI-Assisted Frontend: Safely Refactoring React Components](https://dev.to/kowshik_jallipalli_a7e0a5/ai-assisted-frontend-safely-refactoring-react-components-with-code-agents-213d)
