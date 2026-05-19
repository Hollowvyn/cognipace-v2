import { describe, expect, it } from 'vitest'

import { readLeetCodeSubmissionResult } from './submission-result-reader'

const location = {
  slug: 'two-sum',
  url: 'https://leetcode.com/problems/two-sum/',
  host: 'leetcode.com',
}

describe('readLeetCodeSubmissionResult', () => {
  it('reads an accepted submission result with submitted result code', () => {
    document.body.innerHTML = `
      <main>
        <section data-e2e-locator="submission-result">
          <h3>Accepted</h3>
          <a href="/submissions/detail/1234567890/">Details</a>
          <dl>
            <dt>Runtime</dt>
            <dd>42 ms</dd>
            <dt>Memory</dt>
            <dd>16.7 MB</dd>
          </dl>
          <p>58 / 58 testcases passed</p>
          <h3>Code | Python3</h3>
          <pre>class Solution:
    def twoSum(self):
        return []</pre>
        </section>
      </main>
    `

    expect(
      readLeetCodeSubmissionResult(document, {
        location,
        now: () => 7000,
      }),
    ).toEqual({
      location,
      submissionId: '1234567890',
      source: 'dom',
      status: 'accepted',
      statusText: 'Accepted',
      checkedAt: 7000,
      runtime: '42 ms',
      memory: '16.7 MB',
      passedTestCount: 58,
      totalTestCount: 58,
      failingTestcase: null,
      errorMessage: null,
      resultCodeSnapshot: {
        code: 'class Solution:\n    def twoSum(self):\n        return []',
        language: 'Python3',
        source: 'code-block',
        capturedAt: 7000,
      },
    })
  })

  it('reads a failed submission result without requiring a result code block', () => {
    document.body.innerHTML = `
      <main>
        <section class="submission-result-panel">
          <h3>Wrong Answer</h3>
          <p>37 / 58 testcases passed</p>
          <div>Input nums = [3,2,4], target = 6</div>
          <div>Output [0,1]</div>
          <div>Expected [1,2]</div>
        </section>
      </main>
    `

    expect(
      readLeetCodeSubmissionResult(document, {
        location,
        now: () => 9000,
      }),
    ).toMatchObject({
      status: 'wrong-answer',
      statusText: 'Wrong Answer',
      passedTestCount: 37,
      totalTestCount: 58,
      failingTestcase: 'nums = [3,2,4], target = 6',
      resultCodeSnapshot: {
        code: null,
        language: null,
        source: 'none',
      },
    })
  })

  it('reads result code from the page when the status root is separate', () => {
    document.body.innerHTML = `
      <main>
        <section data-e2e-locator="submission-result">
          <h3>Accepted</h3>
          <span>Runtime 9 ms</span>
          <span>Memory 17 MB</span>
        </section>
        <section>
          <h3>Code | Python3</h3>
          <pre>class Solution:
    pass</pre>
        </section>
      </main>
    `

    expect(
      readLeetCodeSubmissionResult(document, {
        location,
        now: () => 10000,
      })?.resultCodeSnapshot,
    ).toEqual({
      code: 'class Solution:\n    pass',
      language: 'Python3',
      source: 'code-block',
      capturedAt: 10000,
    })
  })

  it('ignores problem content that looks similar to a submission result', () => {
    document.body.innerHTML = `
      <main>
        <nav>Accepted</nav>
        <article>
          <h1>Two Sum</h1>
          <p>You may assume that each input would have exactly one solution.</p>
          <p>Example 1: Input: nums = [2,7,11,15], target = 9</p>
          <p>Output: [0,1]</p>
          <p>Expected: [0,1]</p>
          <h3>Code | Python3</h3>
          <pre>problem statement code snippet</pre>
        </article>
      </main>
    `

    expect(readLeetCodeSubmissionResult(document, { location })).toBeNull()
  })

  it('reads a bounded unlabelled result container', () => {
    document.body.innerHTML = `
      <main>
        <div>
          <section>
            <div>Accepted 63 / 63 testcases passed</div>
            <div>Runtime 4 ms</div>
            <div>Memory 20.62 MB</div>
            <div>Code | Python3</div>
            <pre>class Solution:
    pass</pre>
          </section>
        </div>
      </main>
    `

    expect(
      readLeetCodeSubmissionResult(document, {
        location,
        now: () => 11000,
      }),
    ).toMatchObject({
      status: 'accepted',
      runtime: '4 ms',
      memory: '20.62 MB',
      passedTestCount: 63,
      totalTestCount: 63,
      resultCodeSnapshot: {
        code: 'class Solution:\n    pass',
        language: 'Python3',
      },
    })
  })

  it('returns null before LeetCode renders a terminal submission result', () => {
    document.body.innerHTML = `
      <main>
        <h1>Two Sum</h1>
        <button data-e2e-locator="console-submit-button">Submit</button>
      </main>
    `

    expect(readLeetCodeSubmissionResult(document, { location })).toBeNull()
  })
})
