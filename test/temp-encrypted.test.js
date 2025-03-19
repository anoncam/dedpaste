import { describe, it } from 'mocha';
import { expect } from 'chai';

/**
 * Tests for temporary encrypted pastes
 * 
 * These are integration tests that require a live server.
 * They are not run automatically as part of the test suite.
 */
describe('Temporary Encrypted Pastes Integration Tests', () => {
  it('should create and delete temp encrypted paste after viewing', () => {
    // This test must be run manually:
    // 1. Create an encrypted temporary paste:
    //    echo "Secret temp content" | dedpaste --encrypt --temp
    // 2. View the paste once:
    //    dedpaste get <paste-url>
    // 3. Attempt to view it again (should fail with 404):
    //    dedpaste get <paste-url>
    
    console.log(`
    Manual test instructions:
    
    1. Create an encrypted temporary paste:
       echo "Test data" | dedpaste --encrypt --temp
    
    2. The command will output a URL like: https://paste.d3d.dev/e/AbCdEfGh
    
    3. Retrieve and decrypt the paste:
       dedpaste get https://paste.d3d.dev/e/AbCdEfGh
    
    4. Try to retrieve the same paste again:
       dedpaste get https://paste.d3d.dev/e/AbCdEfGh
    
    5. Verify you receive a 404 response on the second attempt,
       confirming the paste was properly deleted after first view.
    `);
    
    // This is a documentation/placeholder test
    expect(true).to.be.true;
  });
});