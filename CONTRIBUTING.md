# Contributing to Cloudflare MCP Server

Thank you for considering contributing to the Cloudflare MCP Server project! This document outlines the guidelines and processes for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style and Standards](#code-style-and-standards)
- [Pull Request Process](#pull-request-process)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Guidelines](#documentation-guidelines)
- [Issue Reporting](#issue-reporting)
- [Feature Requests](#feature-requests)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

Examples of unacceptable behavior include:

- The use of sexualized language or imagery and unwelcome sexual attention or advances
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate in a professional setting

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Cloudflare account (for deployment)
- Wrangler CLI (`npm install -g wrangler`)

### Setting Up the Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/cloudflare-mcp-server.git
   cd cloudflare-mcp-server
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Configure your Cloudflare account with Wrangler:
   ```bash
   wrangler login
   ```
5. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

1. **Plan your changes**: Before making changes, understand the project structure and how your changes fit in.
2. **Make your changes**: Implement your feature or bugfix.
3. **Write tests**: Add tests for your changes to ensure they work as expected.
4. **Run tests**: Ensure all tests pass.
5. **Update documentation**: Update any relevant documentation.
6. **Commit your changes**: Use clear and descriptive commit messages.
7. **Push your changes**: Push your changes to your fork.
8. **Submit a pull request**: Create a pull request from your fork to the main repository.

### Local Development

Run the server locally:

```bash
npm run dev
```

This will start a local development server at `http://localhost:8787`.

## Code Style and Standards

### TypeScript Guidelines

- Use TypeScript for all new code
- Follow the existing code style in the project
- Use interfaces for defining object shapes
- Use proper type annotations for function parameters and return values
- Avoid using `any` type unless absolutely necessary
- Use async/await for asynchronous code

### Formatting

The project uses ESLint and Prettier for code formatting and linting. Before submitting a pull request, ensure your code passes linting:

```bash
npm run lint
```

To automatically fix linting issues:

```bash
npm run lint:fix
```

### Naming Conventions

- **Files**: Use kebab-case for file names (e.g., `my-file.ts`)
- **Classes**: Use PascalCase for class names (e.g., `MyClass`)
- **Interfaces**: Use PascalCase for interface names (e.g., `MyInterface`)
- **Variables and Functions**: Use camelCase for variable and function names (e.g., `myVariable`, `myFunction`)
- **Constants**: Use UPPER_SNAKE_CASE for constants (e.g., `MY_CONSTANT`)
- **Tools and Resources**: Use snake_case for tool and resource names (e.g., `my_tool`, `my_resource`)

### Code Organization

- Keep files focused on a single responsibility
- Group related functionality in the same directory
- Use clear and descriptive names for files, functions, and variables
- Add comments for complex logic or non-obvious behavior
- Use JSDoc comments for public APIs

## Pull Request Process

1. **Create a branch**: Create a branch for your feature or bugfix.
2. **Make your changes**: Implement your feature or bugfix.
3. **Write tests**: Add tests for your changes.
4. **Run tests**: Ensure all tests pass.
5. **Update documentation**: Update any relevant documentation.
6. **Commit your changes**: Use clear and descriptive commit messages.
7. **Push your changes**: Push your changes to your fork.
8. **Submit a pull request**: Create a pull request from your fork to the main repository.

### Pull Request Template

When submitting a pull request, please use the following template:

```markdown
## Description
[Provide a brief description of the changes in this pull request]

## Related Issue
[Link to the related issue, if applicable]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Code refactoring
- [ ] Other (please describe)

## Checklist
- [ ] I have read the CONTRIBUTING.md document
- [ ] My code follows the code style of this project
- [ ] I have added tests to cover my changes
- [ ] All new and existing tests passed
- [ ] I have updated the documentation accordingly
- [ ] My changes generate no new warnings
```

### Code Review Process

All pull requests will be reviewed by at least one maintainer. The review process may include:

- Automated checks (CI/CD pipeline)
- Code review by maintainers
- Discussion of changes
- Requests for changes

Once the pull request is approved, it will be merged into the main branch.

## Testing Guidelines

### Types of Tests

The project includes several types of tests:

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test how components work together
- **End-to-End Tests**: Test the entire system from a user's perspective

### Writing Tests

- Write tests for all new features and bugfixes
- Follow the existing test patterns in the project
- Use descriptive test names that explain what is being tested
- Keep tests focused on a single functionality
- Use mocks and stubs for external dependencies

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit       # Unit tests
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests
```

## Documentation Guidelines

### Code Documentation

- Use JSDoc comments for public APIs
- Add inline comments for complex logic or non-obvious behavior
- Keep comments up-to-date with code changes

### Project Documentation

- Update README.md with new features or changes
- Update API documentation when adding or modifying endpoints
- Create or update guides for new functionality

## Issue Reporting

### Bug Reports

When reporting a bug, please include:

- A clear and descriptive title
- Steps to reproduce the bug
- Expected behavior
- Actual behavior
- Screenshots or error messages (if applicable)
- Environment information (browser, OS, etc.)

### Feature Requests

When requesting a feature, please include:

- A clear and descriptive title
- A detailed description of the feature
- Why the feature would be useful
- Any relevant examples or use cases

## Feature Requests

We welcome feature requests! To submit a feature request:

1. Check if the feature has already been requested
2. Create a new issue with the "feature request" label
3. Provide a clear and detailed description of the feature
4. Explain why the feature would be useful
5. Provide examples or use cases if applicable

Thank you for contributing to the Cloudflare MCP Server project!