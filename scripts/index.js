/* global mocha A11yDialog */

const currentUrl = new URL(window.location.href);
const SERVER_PROD_URL = 'https://thinkful-ei-eval-server.herokuapp.com';
const BASE_URL = currentUrl.searchParams.get('debug') === '1' ? 'http://localhost:8080' : SERVER_PROD_URL;

const state = {
  validToken: null,
  tokenSubmitting: false,
  error: null,
  tests: [],
  changedToken: false,
  submitCodeModal: false,
  submitResponse: {},
};

const Templates = {
  instructions() {
    return `
      <p class="error"></p>
      <h2>Instructions</h2>
      <p>In the <code>student.js</code> file, complete the functions as described below. If you write them correctly, the tests on the right hand side will pass (i.e. you will see only green check marks against each test). When the test is complete, use the Submit Code button below.</p>

      <ul>
        <li>You can refresh this page whenever you make changes to see if your tests pass</li>
        <li>Feel free to use the dev console to debug your work, logging output from within your function</li>
        <li>You are encouraged to use online documentation and resources to look up methods, but not to find solutions.</li>
        <li>Talk through your thought process so your evaluator can understand how you're solving the problem.</li>
      </ul>

      <button id="reset-password" class="btn">Reset Passphrase</button>
      <button id="open-submit-code" class="btn btn-primary">Submit Code</button>

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
  },

  submissionResponse() {
    return `
      <div class="submit-response js-submit-response ${state.submitResponse.status !== 201 ? 'error' : ''}">
        ${state.submitResponse.status === 201 ? 'Submission successful. Thank you!' : state.submitResponse.message || '' }
      </div>
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

  if (state.submitCodeModal) {
    return $('.js-submit-response').replaceWith(Templates.submissionResponse());
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

const formToJson = formData => {
  const jsonObj = {};
  for (const [key, val] of formData.entries()) jsonObj[key] = val;
  return JSON.stringify(jsonObj);
};

const submitTests = function(token, data) {
  const url = new URL(`${BASE_URL}/api/tests/submission`);
  url.searchParams.set('token', token);

  return $.ajax({
    url,
    method: 'POST',
    contentType: 'application/json',
    dataType: 'json',
    data,
  });
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
  onClickOpenModal() {
    state.submitCodeModal = true;
    render();
  },

  onClickCancelModal() {
    window.location = window.location.href;
  },

  onSubmitTests(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = formToJson(formData);

    submitTests(state.validToken, data)
      .then((res) => {
        state.submitResponse.status = 201;
        render();
      })
      .catch(err => {
        console.log('fail!');
        console.log(err);
        state.submitResponse.status = err.status;
        state.submitResponse.message = err.responseJSON.message;
        render();
      });
  },

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
  const el = document.getElementById('modal');
  const content = document.getElementById('main');
  const dialog = new A11yDialog(el, main);

  const $directions = $('.directions');
  const $modal = $('#modal');

  dialog.on('show', function (el, ev) {
    state.submitCodeModal = true;
  });

  dialog.on('hide', function (el, ev) {
    state.submitCodeModal = false;
    $directions.find('#open-submit-code').focus();
  });

  $directions.on('submit', '#password-form', Listeners.onSubmitPasswordForm);
  $directions.on('click', '#reset-password', Listeners.onClickResetPassword);
  $directions.on('click', '#open-submit-code', dialog.show.bind(dialog));

  $modal.on('click', '.cancel', dialog.hide.bind(dialog));
  $modal.on('submit', '#submit-code-form', Listeners.onSubmitTests);

  detectToken();
};

$(main);
