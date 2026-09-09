# WCAG 2.2 AA Audit Checklist

**Date**: 2026-09-09  
**Target**: WCAG 2.2 Level AA compliance  
**Scope**: Critical user flows (login, learning, quizzes, certificates)

## Perceivable

### 1.1 Text Alternatives

- [ ] All images have `alt` text
- [ ] Decorative images have `alt=""` or `aria-hidden="true"`
- [ ] Charts/graphs have text alternatives or data tables
- [ ] Icons have accessible labels

### 1.2 Time-Based Media

- [ ] Videos have captions (if applicable)
- [ ] Audio has transcripts (if applicable)
- [ ] No auto-playing media

### 1.3 Adaptable

- [ ] Information structure is programmatically determinable
- [ ] Reading order is logical
- [ ] Instructions don't rely solely on sensory characteristics
- [ ] Form labels are properly associated

### 1.4 Distinguishable

- [ ] Color is not the only visual means of conveying information
- [ ] Text contrast ratio ≥4.5:1 (normal text)
- [ ] Large text contrast ratio ≥3:1
- [ ] UI components have ≥3:1 contrast
- [ ] Text can be resized up to 200% without loss
- [ ] Content reflows at 320px width
- [ ] No horizontal scrolling at 320px
- [ ] Spacing can be adjusted without breaking layout

## Operable

### 2.1 Keyboard Accessible

- [ ] All functionality available via keyboard
- [ ] No keyboard traps
- [ ] Skip navigation link present
- [ ] Focus order is logical
- [ ] Focus is visible

### 2.2 Enough Time

- [ ] Session timeout warns user
- [ ] User can extend session
- [ ] No auto-refresh without warning
- [ ] Timed content can be paused/stopped

### 2.3 Seizures and Physical Reactions

- [ ] No content flashes more than 3 times per second
- [ ] Animations can be disabled (reduced motion)

### 2.4 Navigable

- [ ] Page titles are descriptive
- [ ] Focus order is meaningful
- [ ] Link purpose is clear
- [ ] Multiple ways to find pages
- [ ] Headings and labels are descriptive
- [ ] Focus is visible on interactive elements

### 2.5 Input Modalities

- [ ] Touch targets ≥44px × 44px
- [ ] Dragging can be avoided
- [ ] Motion-triggered actions have alternatives

## Understandable

### 3.1 Readable

- [ ] Page language is declared (`lang` attribute)
- [ ] Language changes are marked
- [ ] Abbreviations have expansions

### 3.2 Predictable

- [ ] Focus doesn't cause unexpected context change
- [ ] Input doesn't cause unexpected context change
- [ ] Navigation is consistent
- [ ] Components are consistent

### 3.3 Input Assistance

- [ ] Errors are identified and described
- [ ] Labels and instructions are provided
- [ ] Error suggestions are provided
- [ ] Error prevention for legal/financial data

## Robust

### 4.1 Compatible

- [ ] HTML is valid
- [ ] Name, role, value is set for UI components
- [ ] Status messages are programmatically set

## Critical Flows to Test

### 1. Login Flow
- [ ] Email input has label
- [ ] Password input has label
- [ ] Error messages are announced
- [ ] Focus moves to error on submission
- [ ] Submit button is keyboard accessible

### 2. Learning Flow
- [ ] Level map is keyboard navigable
- [ ] Activity content is readable
- [ ] Code blocks have proper semantics
- [ ] Embedded content has alternatives

### 3. Quiz Flow
- [ ] Question text is readable
- [ ] Answer options are keyboard accessible
- [ ] Submit button is accessible
- [ ] Results are announced

### 4. Certificate Flow
- [ ] Download button is accessible
- [ ] QR code has text alternative
- [ ] Print button works with keyboard

### 5. Teacher Dashboard
- [ ] Charts have text alternatives
- [ ] Filters are keyboard accessible
- [ ] Data tables have headers

## Testing Tools

### Automated
- [ ] axe-core scan (browser extension)
- [ ] Lighthouse accessibility audit
- [ ] WAVE evaluation tool

### Manual
- [ ] Keyboard-only navigation test
- [ ] Screen reader test (NVDA/VoiceOver)
- [ ] High contrast mode test
- [ ] Zoom to 200% test

## Known Issues

| Issue | Severity | Status |
|-------|----------|--------|
| Touch targets may be <44px on some buttons | Medium | Needs verification |
| Charts may lack text alternatives | Medium | Needs verification |
| Focus visibility may be insufficient | Low | Needs verification |

## Acceptance Criteria

- [ ] All critical flows pass automated checks
- [ ] All critical flows pass keyboard-only test
- [ ] All critical flows pass screen reader test
- [ ] No Level A violations
- [ ] No Level AA violations (except documented exceptions)

---

**Audit conducted by**: Buffy (Codebuff agent)  
**Date**: 2026-09-09  
**Status**: IN PROGRESS
