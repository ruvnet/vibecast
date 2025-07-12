# 🤝 Contributing to VibeCast

Thank you for your interest in contributing to VibeCast! We welcome contributions from developers, researchers, and visionaries who share our mission of democratizing GPU computing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contribution Process](#contribution-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community](#community)

## 📜 Code of Conduct

We are committed to providing a welcoming and inclusive environment. All contributors are expected to:

- Be respectful and constructive in all interactions
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/vibecast.git
   cd vibecast
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/vibecast/vibecast.git
   ```

## 🛠️ Development Setup

### Prerequisites

- Node.js 16+ and npm
- Rust 1.70+ with wasm32-unknown-unknown target
- Git
- A WebGPU-compatible browser for testing

### Installation

```bash
# Install dependencies
npm install

# Install Rust dependencies
cd cuda-rust-wasm
cargo build

# Install wasm-pack
cargo install wasm-pack

# Run tests
npm test
```

## 🔄 Contribution Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write clean, documented code
   - Add tests for new functionality
   - Update documentation as needed

3. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add quantum computing support"
   ```
   
   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation changes
   - `test:` test additions/modifications
   - `refactor:` code refactoring
   - `perf:` performance improvements
   - `chore:` maintenance tasks

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a Pull Request**:
   - Go to the original repository
   - Click "New Pull Request"
   - Select your feature branch
   - Fill out the PR template
   - Submit for review

## 💻 Coding Standards

### Rust Code

- Follow the [Rust Style Guide](https://doc.rust-lang.org/1.0.0/style/README.html)
- Use `cargo fmt` before committing
- Run `cargo clippy` and address warnings
- Write safe code by default, document `unsafe` blocks

### JavaScript/TypeScript

- Use ESLint configuration provided
- Prefer functional programming patterns
- Use TypeScript for new code
- Document complex algorithms

### General

- Keep functions small and focused
- Write self-documenting code
- Add comments for complex logic
- Use meaningful variable names

## 🧪 Testing Guidelines

### Unit Tests

```rust
#[test]
fn test_vector_addition() {
    let a = vec![1.0, 2.0, 3.0];
    let b = vec![4.0, 5.0, 6.0];
    let result = vector_add(&a, &b);
    assert_eq!(result, vec![5.0, 7.0, 9.0]);
}
```

### Integration Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "transpiler"

# Run benchmarks
npm run benchmark
```

### Performance Tests

- Benchmark against native CUDA when possible
- Document performance characteristics
- Test with various input sizes

## 📝 Documentation

### Code Documentation

- Document all public APIs
- Include examples in doc comments
- Explain complex algorithms
- Keep README files up to date

### User Documentation

- Update user guide for new features
- Add examples for common use cases
- Include troubleshooting tips
- Maintain API reference

## 🌐 Community

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: General questions and ideas
- **Discord**: Real-time chat and support
- **Twitter**: Updates and announcements

### Getting Help

- Check existing documentation
- Search closed issues
- Ask in discussions
- Join our Discord community

## 🎯 Areas for Contribution

### High Priority

- WebGPU backend improvements
- Performance optimizations
- Documentation and examples
- Test coverage expansion

### Feature Ideas

- Additional CUDA library support
- New transpilation targets
- Distributed computing features
- Quantum computing preparation

### Research Areas

- Novel GPU algorithms
- Optimization techniques
- Benchmarking methodologies
- Use case studies

## 🏆 Recognition

We value all contributions! Contributors will be:

- Listed in our contributors file
- Mentioned in release notes
- Invited to contributor meetings
- Given credit in documentation

## 📋 Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Documentation updated
- [ ] Performance impact assessed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Changes generate no new warnings
```

## 🙏 Thank You!

Your contributions make VibeCast better for everyone. Whether it's fixing a typo, adding a feature, or proposing a new architecture, every contribution matters.

Welcome to the VibeCast community! 🚀