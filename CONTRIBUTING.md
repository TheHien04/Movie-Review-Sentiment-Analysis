# Contributing to Movie Review Sentiment Analysis

Thank you for your interest in contributing! This document provides guidelines and instructions.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow

## Getting Started

### 1. Fork and Clone
```bash
git clone https://github.com/YOUR_USERNAME/Movie-Review-Sentiment-Analysis.git
cd Movie-Review-Sentiment-Analysis
```

### 2. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 3. Set Up Development Environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

## Development Guidelines

### Code Style

**Python:**
- Follow PEP 8
- Use meaningful variable names
- Add docstrings to functions
- Max line length: 100 characters

**JavaScript:**
- Use ES6+ features
- Use meaningful variable names
- Add comments for complex logic
- Use const/let over var

**CSS:**
- Use modern CSS3 features
- Follow BEM naming convention
- Group related styles
- Use variable colors (theme system)

### Commit Messages

Format: `<type>: <description>`

Types:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style improvement
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance

Example:
```
feat: Add dark mode toggle
fix: Resolve batch upload timeout issue
docs: Update API documentation
```

### Pull Request Process

1. **Create PR with clear title and description**
   - Title: Brief summary of changes
   - Description: Detailed explanation and motivation

2. **Ensure all checks pass:**
   - No syntax errors
   - Code follows guidelines
   - No breaking changes (explain if necessary)

3. **Link related issues**
   - "Fixes #123"
   - "Related to #456"

4. **Request review from maintainers**

## Testing

### Manual Testing

Before submitting PR, test:
1. Single review analysis
2. Batch file upload
3. Model metrics loading
4. Dataset browsing
5. Responsive design (mobile/tablet/desktop)

### Browser Compatibility

Test on:
- Chrome/Chromium (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Feature Areas

### High Priority
- Performance optimization
- User experience improvements
- Security enhancements
- Bug fixes

### Medium Priority
- New sentiment labels
- Export formats
- Advanced filtering
- Analytics

### Lower Priority
- UI polish
- Animation improvements
- Additional themes

## Bug Reports

Include:
1. Clear title
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Environment (OS, browser, Python version)
6. Screenshots/logs if applicable

## Feature Requests

Include:
1. Clear description
2. Use case/motivation
3. Proposed implementation (optional)
4. Examples or mockups

## Documentation

Contribute by:
- Improving README
- Adding code examples
- Clarifying API docs
- Creating tutorials
- Translating documentation

## Questions?

- Check existing issues/discussions
- Open a discussion
- Contact maintainers

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md
- Project README
- Release notes

Thank you for contributing! 🎉

---

**Last Updated:** February 2025
