# Earnings Calculation Debugging

## Background and Motivation
The system appears to be calculating earnings incorrectly - showing values that are 10x higher than expected (10x instead of 10%). Additionally, the ShopMy merchant data is not being passed into the earnings calculation properly, even though the metadata field exists on the link. We need to systematically debug this issue with heavy logging to identify the root cause.

## Key Challenges and Analysis
1. The earnings calculations appear to be scaled incorrectly (10x vs. 10%)
2. ShopMy merchant metadata (specifically fullPayout) is not being used in earnings calculations
3. We know that fullPayout should be an integer representing a percentage (e.g., 7 for 7%)

## High-level Task Breakdown
1. [ ] **Trace the data flow for link metadata to earnings calculation**
   - Success criteria: We can see exactly how link metadata flows through the system

2. [ ] **Examine the earnings calculation logic**
   - Success criteria: We understand the math being applied and where the 10x issue is occurring

3. [ ] **Add logging throughout the earnings calculation process**
   - Success criteria: Log statements show values at each step of the calculation

4. [ ] **Check how ShopMy metadata is attached to links**
   - Success criteria: We can confirm metadata is properly attached and formatted

5. [ ] **Inspect how fullPayout is accessed and used**
   - Success criteria: We understand why fullPayout isn't being correctly accessed

6. [ ] **Develop a fix for both issues**
   - Success criteria: Earnings calculations show correct percentages and use ShopMy metadata

## Project Status Board
- [ ] Identify files involved in earnings calculation
- [ ] Add logging to trace data flow
- [ ] Examine calculation formulas
- [ ] Test with sample ShopMy link
- [ ] Identify and fix scaling issue
- [ ] Implement fix for ShopMy metadata usage

## Current Status / Progress Tracking
Starting the debugging process...

## Executor's Feedback or Assistance Requests
Waiting for initial task to begin...

## Lessons
- Include heavy logging throughout the debugging process
