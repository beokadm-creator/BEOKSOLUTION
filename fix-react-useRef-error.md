# React useRef 오류 해결 가이드

## 오류
```
TypeError: Cannot read properties of null (reading 'useRef')
    at BrowserRouter (react-router-dom.js?v=c81abb2b:6836:32)
```

## 원인
React 19.2.0 + React Router 7.12.0 조합에서 발생하는 버전 호환성 문제

---

## 해결 방법 1: React Router 다운그레이드 (가장 추천)

React 19는 React Router 6.x가 더 안정적입니다.

```bash
npm install react-router-dom@6.28.0
```

### 1-1. package.json 업데이트
```json
{
  "dependencies": {
    "react-router-dom": "^6.28.0"  // 버전 7에서 6으로 변경
  }
}
```

### 1-2. 의존성 재설치
```bash
rm -rf node_modules
npm install
npm run dev
```

---

## 해결 방법 2: node_modules 완전 재설치

```bash
# 1. 캓 및 node_modules 삭제
rm -rf node_modules package-lock.json

# 2. 다시 설치
npm install

# 3. 개발 서버 실행
npm run dev
```

---

## 해결 방법 3: React 최신 안정 버전 사용

```bash
npm install react@^19.0.0 react-dom@^19.0.0
npm install react-router-dom@7.12.0 --force
```

---

## 해결 방법 4: Vite 캓 삭제

```bash
rm -rf node_modules/.vite
rm -rf dist
npm run dev
```

---

## 해결 방법 5: 롤다운-바이테 임시 사용 (임시 조치)

Vite.config.ts를 임시로 롤다운-바이테 제거:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],  // 기본 플러그인 사용
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  // manualChunks 제거 (임시)
})
```

---

## 확인 방법

### 1. 브라우저 캓 삭제
- Chrome: Ctrl+Shift+Delete
- Firefox: Ctrl+F5
- 모든 데이터 삭제 후 새로고침

### 2. 콘솔 에러 확인
오류가 사라졌는지 확인하세요.

### 3. 로컬 스토리지 청소
```javascript
// 브라우저 콘솔
localStorage.clear()
sessionStorage.clear()
location.reload()
```

---

## 추천 순서

1. **먼저 방법 2 시도** (node_modules 재설치) - 가장 확실한 해결책
2. 문제 지속 시 **방법 1 시도** (React Router 다운그레이드)
3. 그래도 문제 시 **방법 5 시도** (롤다운-바이테 제거)
4. 문제 해결 시 **방법 4** (Vite 캓 삭제)로 정상화

---

## 참고 링크
- https://github.com/remix-run/react-router/issues/11323
- https://github.com/remix-run/react-router/discussions/11084
