/* global mocha */

const currentUrl = new URL(window.location.href);
const SERVER_PROD_URL = 'https://thinkful-ei-eval-server.herokuapp.com';
const BASE_URL = currentUrl.searchParams.get('debug') === '1' ? 'http://localhost:8080' : SERVER_PROD_URL;

const state = {
  validToken: null,
  tokenSubmitting: false,
  error: null,
  tests: [],
  changedToken: false,
};

const Templates = {
  instructions() {
    return `
      <p class="error"></p>
      <h2>Instructions</h2>
      <p>In the <code>student.js</code> file, complete the functions as described below. If you write them correctly, the tests on the right hand side will pass (i.e. you will see only green check marks against each test).</p>

      <ul>
        <li>You can refresh this page whenever you make changes to see if your tests pass</li>
        <li>Feel free to use the dev console to debug your work, logging output from within your function</li>
        <li>You are encouraged to use online documentation and resources to look up methods, but not to find solutions.</li>
        <li>Talk through your thought process so your evaluator can understand how you're solving the problem.</li>
      </ul>

      <button id="reset-password">Reset Passphrase</button>

      ${state.tests.map(test => `<hr />${test.instr}`).join('')}
    `;  
  },

  passPrompt() {
    return `
      <h2>Start Test</h2>
      <p>
        To begin, enter the passphrase provided by your instructor.
      </p>
      <form id="password-form">
        <input id="password-form-password" name="password" type="text" />
        <input type="submit" ${state.tokenSubmitting ? 'disabled' : ''} />
      </form>
      <p class="form-status">${ state.tokenSubmitting ? 'Contacting server...' : '' }</p>
      <p class="error"></p>
    `;
  }
};

const runMocha = function() {
  mocha.checkLeaks();
  mocha.globals(['jQuery']);
  mocha.run(() => {

    // Remove ugly stack traces and keep only first line of error
    $.each($('.error'), (ind, el) => {
      const firstLine = $(el).text().split('\n')[0];
      $(el).text(firstLine);
    });
  });
};

const render = function() {
  if (state.changedToken) {
    // Reload page to clear tests cache
    return window.location = window.location.href;
  }

  if (state.validToken) {
    $('.directions').html(Templates.instructions());
    state.tests.forEach(test => eval(test.script));
    runMocha();
  } else {
    $('.directions').html(Templates.passPrompt());
    $('#mocha').empty();
  }

  if (state.error) {
    $('.directions .error').text(state.error);
  } else {
    $('.error').remove();
  }
};

const fetchTests = function(token) {
  const url = new URL(`${BASE_URL}/api/tests`);
  url.searchParams.set('token', token);

  return $.getJSON(url);
};

const setTestsAndRender = function(tests) {
  state.tests = tests;
  render();
};

const setToken = function(token) {
  localStorage.setItem('thinkful-eval-token', token);
  state.validToken = token;
  state.changedToken = true;
};

const Listeners = {
  onSubmitPasswordForm(e) {
    e.preventDefault();
    const token = $('#password-form-password').val();
    state.tokenSubmitting = true;
    state.error = null;
    render();

    fetchTests(token)
      .then(tests => {
        state.tokenSubmitting = false;
        setToken(token);
        setTestsAndRender(tests);
      })
      .catch(err => {
        state.tokenSubmitting = false;
        if (err.status === 401) {
          state.error = 'Incorrect passphrase';
          render();
        } else if (err.status >= 500) {
          state.error = 'Internal Server Error';
          render();
        } else {
          state.error = 'Unknown error';
          render();
          console.log(err);
        }
      });
  },

  onClickResetPassword() {
    localStorage.removeItem('thinkful-eval-token');
    state.validToken = null;
    render();
  }
};

const detectToken = function() {
  if (localStorage.getItem('thinkful-eval-token')) {
    state.validToken = localStorage.getItem('thinkful-eval-token');
    return fetchTests(state.validToken)
      .then(tests => setTestsAndRender(tests))
      .catch(err => {
        console.log(err);
        state.error = 'Server error';
        render();
      });
  } else {
    render();
  }
};

const main = function() {
  $('.directions').on('submit', '#password-form', e => Listeners.onSubmitPasswordForm(e));
  $('.directions').on('click', '#reset-password', Listeners.onClickResetPassword);

  detectToken();
};

$(main);
