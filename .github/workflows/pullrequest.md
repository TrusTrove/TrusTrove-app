## Pull Request Checklist

### General

- [ ] PR title follows conventional commit format (`type(scope): description`)
- [ ] Branch name follows `issue-<number>-<description>` format
- [ ] Linked to relevant issue(s) with `Closes #<number>` or `Fixes #<number>`
- [ ] Description clearly explains what changes were made and why
- [ ] Breaking changes documented (if applicable)

### Code Quality

- [ ] Code follows project style guidelines (`make fmt` passes)
- [ ] No clippy warnings (`make lint` passes)
- [ ] No new `panic!` statements (use `panic_with_error!` instead)
- [ ] Public functions have proper documentation
- [ ] Complex logic is explained with comments

### Testing

- [ ] All existing tests still pass (`make test` passes)
- [ ] New functionality is covered by tests
- [ ] Test coverage meets minimum requirements (90%+ for new features)
- [ ] Tests follow naming conventions (`test_<functionality>_scenario`)
- [ ] Edge cases and error conditions are tested

### Security & Events

- [ ] Access control properly implemented and tested
- [ ] All state changes emit appropriate events
- [ ] Input validation is comprehensive
- [ ] Reentrancy protection where needed
- [ ] CEI pattern (Checks-Effects-Interactions) followed

### Documentation

- [ ] README updated (if applicable)
- [ ] API documentation updated (if applicable)
- [ ] Architecture docs updated (if applicable)
- [ ] Examples added or updated (if applicable)

## Description

<!--
Briefly describe what this PR does and why it's needed.
Include:
- What problem you're solving
- How you solved it
- Any design decisions made
- Performance implications (if any)
-->

## Type of Change

<!-- Check all that apply -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Security improvement

## Testing

<!--
Describe how you tested your changes:
- Unit tests added/modified
- Integration tests
- Manual testing steps
- Test coverage metrics
-->

## Security Considerations

<!--
Address any security implications:
- Access control changes
- Fund flow modifications
- New attack vectors
- Mitigation strategies
-->

## Screenshots / Diagrams

<!--
Add screenshots or diagrams if applicable:
- UI changes
- Architecture diagrams
- Flow charts
-->

## Additional Context

<!--
Any additional context, links, or resources that help reviewers understand the changes:
- Related issues
- Reference implementations
- Design documents
- Research links
-->

## Reviewer Focus Areas

<!--
Suggest specific areas for reviewers to focus on:
- "Please focus on the access control logic"
- "Pay special attention to the yield calculation accuracy"
- "Review the error handling in edge cases"
-->

---

**By submitting this PR, I confirm that:**

- I have read and followed the contribution guidelines
- My code follows the project's style standards
- I have performed a self-review of my code
- I have added tests that prove my fix is effective or that my feature works
- I have tested my changes thoroughly
- I understand that this PR may be closed if I don't respond to feedback in a timely manner
