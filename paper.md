# Proposal for a Master’s Research Thesis
## *Toward an AI-Native Programming Language: Functional Semantics, Real-Time Interpretation, and Domain-Visible Syntax for Rapidly Changing Systems*

### Candidate
Timothy Stokes  

### Degree
Master of Computer Science (Research)  

### Proposed Duration
18–24 months  

---

## Abstract

Software development is entering a phase where human developers and AI systems co-produce code continuously. Current mainstream languages were not designed for this mode of work. They often prioritize mechanism-oriented syntax, compile-time workflows, and abstraction-heavy idioms that reduce transparency when rapid adaptation, testability, and human-AI collaboration are required.  

This thesis proposes the design and evaluation of a new programming language, provisionally called **Aster**, built around three core demands emerging from AI-assisted engineering:  
1. **Functional semantics** to improve determinism, composability, and bullet-proof testing.  
2. **Interpreted execution** for real-time evaluation and immediate feedback loops.  
3. **Terse, low-keyword syntax** to maximize visibility of domain and business language, shifting focus from mechanisms to intent.  

The research will produce (i) a formal language model, (ii) a reference interpreter, (iii) a testing and evaluation framework, and (iv) empirical evidence comparing Aster-style workflows with established languages in AI-assisted coding scenarios. Outcomes will be assessed through correctness, development latency, readability under AI collaboration, and semantic drift resistance in evolving requirements.  

The expected contribution is a grounded argument—and working artifact—for an AI-native programming paradigm where simplicity and explicit data flow improve software reliability and socio-technical alignment in a changing world.

---

## 1. Background and Motivation

The social and technical context of programming has changed. Requirements now shift weekly, systems integrate with probabilistic AI services, and engineering teams increasingly rely on AI copilots for coding, testing, and debugging. This introduces a new challenge: **the language itself becomes part of the alignment boundary between human intent, AI generation, and executable behavior**.

Many current languages evolved under assumptions that no longer hold:
- Build/compile cycles were acceptable as the dominant feedback loop.
- Framework conventions could hide complexity without harming comprehension.
- Expert-only abstraction density could be tolerated in exchange for flexibility.
- Testing could be retrofitted around mutable, side-effect-heavy designs.

In AI-assisted development, these assumptions degrade outcomes. AI tools perform better when programs are explicit, deterministic, and structurally regular. Humans review AI-generated code more effectively when domain concepts remain visible and low-noise. In this context, language design can directly influence correctness, maintainability, and delivery speed.

This proposal addresses that gap by asking: **What should a programming language look like when designed primarily for real-time human-AI co-development under rapid change?**

---

## 2. Problem Statement

Existing language ecosystems exhibit four recurring mismatches with AI-era demands:

1. **Testing fragility from implicit mutation and side effects**  
   Programs are harder to reason about and verify when state changes are distributed and non-local.

2. **Slow feedback due to compile/build orchestration**  
   In contexts where requirements shift continuously, delayed execution feedback increases iteration cost.

3. **Mechanism-heavy syntax that obscures domain intent**  
   Code often foregrounds language machinery (types, boilerplate, framework contracts) rather than business rules.

4. **Cognitive overhead from excessive language surface area**  
   Large keyword sets and many equivalent forms hinder both human understanding and AI generation precision.

The central research problem is therefore:

> **How can a programming language be designed to maximize correctness, speed of iteration, and domain-level clarity under AI-assisted development constraints?**

---

## 3. Research Aim and Objectives

### Aim
To design, implement, and evaluate an AI-native programming language model that improves reliability and development velocity by prioritizing functional behavior, interpreted execution, terse domain-visible syntax, and structural simplicity.

### Objectives
1. Define formal design principles for AI-native language behavior.
2. Specify a minimal but expressive core semantics.
3. Implement a reference interpreter and runtime.
4. Develop a testing strategy emphasizing deterministic evaluation and property-like guarantees.
5. Empirically compare development outcomes against selected mainstream baselines.
6. Derive design guidelines for future languages used in human-AI software production.

---

## 4. Research Questions

The study is driven by the following questions:

### RQ1 — Functional Correctness
How far does a predominantly functional language model reduce test brittleness and defect rates in AI-assisted coding tasks?

### RQ2 — Real-Time Iteration
Does interpreted, immediate execution materially reduce iteration time and semantic regression when requirements evolve rapidly?

### RQ3 — Domain Visibility
Can terse syntax with minimal reserved vocabulary improve readability, review quality, and AI generation alignment by making business/domain language dominant in code?

### RQ4 — Simplicity vs Expressiveness
What is the minimal semantic core that remains expressive enough for practical application logic while preserving learnability and consistency?

### RQ5 — Human-AI Collaboration Quality
How do these design choices affect prompt-to-code fidelity, correction cycles, and code review confidence in mixed human-AI workflows?

---

## 5. Proposed Design Principles (Framed by Demand)

Rather than beginning with traditional mechanisms, the design is framed by demand-side questions:

### 5.1 If correctness is non-negotiable, what semantics are easiest to test?
- Prefer pure functions and explicit data flow.
- Minimize hidden state and side effects.
- Treat behavior as composable transformations.
- Make outputs a direct, inspectable consequence of inputs.

### 5.2 If systems change continuously, what execution model best supports adaptation?
- Use interpreted evaluation for immediate execution feedback.
- Support incremental, real-time probing of behavior.
- Favor short loop cycles: write, run, inspect, adjust.

### 5.3 If AI writes and humans verify, what syntax maximizes intent clarity?
- Keep keyword inventory small.
- Reduce boilerplate and ceremony.
- Let domain/business terms dominate source text.
- Preserve structural regularity to improve machine generation and human scanning.

### 5.4 If complexity accumulates inevitably, what constraints keep it bounded?
- One obvious way to express common operations.
- Consistent composition model across data and behavior.
- Explicit boundaries around effects.
- Language-level preference for simplicity over feature abundance.

---

## 6. Methodology

The thesis will use a **design science research (DSR)** methodology with empirical evaluation.

### Phase 1: Conceptual Modeling
- Literature review: functional language design, interpreter architecture, readability research, AI-assisted software engineering.
- Derivation of language requirements from AI-era workflow constraints.
- Initial semantic model and grammar.

### Phase 2: Language Specification
- Formal specification of syntax, evaluation rules, and runtime behavior.
- Definition of value model, function model, and effect boundaries.
- Error model emphasizing explicitness and debuggability.

### Phase 3: Reference Implementation
- Build an interpreter (likely in JavaScript/TypeScript for portability).
- Implement parser, evaluator, standard library primitives, REPL/file execution.
- Build deterministic test harness and trace tooling.

### Phase 4: Experimental Evaluation
Use controlled programming tasks under two settings:
1. Human-only baseline.
2. Human + AI copilot condition.

Compare Aster against 1–2 established languages on:
- Time to correct implementation.
- Number of revisions until stable behavior.
- Test pass rates and mutation sensitivity.
- Semantic drift under requirement changes.
- Reviewer accuracy and confidence.

### Phase 5: Analysis and Refinement
- Quantitative analysis (time, defects, iteration counts).
- Qualitative analysis (developer feedback, review experience, AI prompt dynamics).
- Refine language model and document trade-offs.

---

## 7. Evaluation Framework

Success will be measured across five dimensions.

### 7.1 Correctness and Test Robustness
- Unit/property test pass consistency.
- Defect density in benchmark tasks.
- Regression incidence after requirement changes.

### 7.2 Iteration Latency
- Median time from code change to executable feedback.
- Cycle count to achieve acceptance criteria.
- Recovery time from failed AI-generated suggestions.

### 7.3 Domain/Business Readability
- Ratio of domain terms to mechanism tokens.
- Reviewer comprehension time.
- Accuracy of requirement-to-code mapping by independent evaluators.

### 7.4 Simplicity Metrics
- Grammar/keyword footprint.
- Number of concepts required to complete benchmark tasks.
- Pattern consistency across task categories.

### 7.5 Human-AI Alignment
- Prompt-to-code fidelity.
- Number of clarification prompts required.
- Rate of accepted first-pass AI outputs.

---

## 8. Scope and Delimitations

### In Scope
- Core language semantics and interpreter.
- Functional-first programming model.
- REPL-first and script execution model.
- Empirical assessment on medium-scale tasks.

### Out of Scope
- Native compilation and advanced optimization.
- Full enterprise ecosystem (ORMs, web frameworks, package network maturity).
- Claims of universal superiority over all language paradigms.

The research aims to establish **viability and measurable benefits** in target scenarios, not to replace all programming contexts.

---

## 9. Novelty and Expected Contributions

This thesis expects to contribute:

1. **A principled AI-native language design framework** grounded in demand-side constraints.
2. **A working interpreter and formalized semantics** demonstrating practical feasibility.
3. **An evaluation methodology** tailored to human-AI programming workflows.
4. **Empirical evidence** on trade-offs between simplicity, expressiveness, and reliability.
5. **Actionable guidelines** for future language and tooling design in AI-driven software engineering.

---

## 10. Risks and Mitigation

### Risk 1: Oversimplification harms expressiveness
**Mitigation:** staged benchmarks of increasing complexity; controlled extension criteria.

### Risk 2: Evaluation bias from researcher familiarity
**Mitigation:** external participants, predefined rubrics, blinded review of artifacts.

### Risk 3: AI tooling variability affects results
**Mitigation:** fixed model/version windows per experiment; repeated trials; normalized prompts.

### Risk 4: Runtime performance criticism
**Mitigation:** make explicit that thesis priority is correctness and adaptation speed; report performance transparently without over-claiming.

---

## 11. Ethical and Societal Considerations

- **Human agency:** Language design should support accountability, not hide decision logic behind generated code.
- **Maintainability:** Prioritize readability and transparent semantics to reduce long-term operational risk.
- **Inclusivity:** Reduce accidental complexity to lower barriers for interdisciplinary contributors.
- **AI governance:** Improve traceability of intent-to-implementation to support safer deployment in sensitive domains.

---

## 12. Proposed Timeline (Indicative)

### Months 1–3
Literature review, requirement framing, initial semantics.

### Months 4–7
Language specification and prototype interpreter.

### Months 8–11
Testing framework, benchmark suite design, pilot studies.

### Months 12–15
Main empirical study (human and human+AI conditions).

### Months 16–18
Analysis, language refinements, thesis drafting.

### Months 19–24 (if extended)
Additional validation tasks, revisions, submission preparation.

---

## 13. Preliminary Chapter Structure

1. Introduction and Motivation  
2. Literature Review  
3. Design Requirements for AI-Native Languages  
4. Language Specification and Semantics  
5. Interpreter Architecture and Implementation  
6. Evaluation Design and Benchmark Methodology  
7. Results and Analysis  
8. Discussion: Trade-offs, Limits, and Generalization  
9. Conclusion and Future Work  

---

## 14. Conclusion

The software landscape now requires languages that are not only expressive, but also resilient under rapid change, testable under pressure, and legible in mixed human-AI workflows. This proposal argues that a language centered on functional semantics, interpreted real-time evaluation, terse domain-visible syntax, and strict simplicity can better meet these demands.  

By producing both a formal model and measurable evidence, this research aims to move language design from tradition-driven evolution toward demand-driven adaptation for the next era of computing.

---

## Preliminary References (to be expanded in full proposal stage)

- Wirth, N. (1971). *Program development by stepwise refinement*.  
- Backus, J. (1978). *Can Programming Be Liberated from the von Neumann Style?*  
- Hughes, J. (1989). *Why Functional Programming Matters*.  
- Wadler, P. (1992). *The Essence of Functional Programming*.  
- Claessen, K., & Hughes, J. (2000). *QuickCheck: A Lightweight Tool for Random Testing*.  
- Taha, W. (ed.) (2004+). *Multi-stage and interpreted execution literature*.  
- Contemporary human-AI coding workflow studies (2022–present) on copilot productivity, review burden, and defect propagation.

