const state = {
  validToken: null,
  error: null,
};

const Templates = {
  instructions() {
    return `
      <h2>Instructions</h2>
      <p>In the <code>student.js</code> file, complete the functions as described below. If you write them correctly, the tests on the right hand side should pass (you will only see green check marks for each test).</p>

      <ul>
        <li>You can refresh this page whenever you make changes to see if your tests pass</li>
        <li>Feel free to use the dev console to debug your work, logging output from within your function</li>
        <li>You are encouraged to use online documentation and resources to look up methods, but not to find solutions.</li>
        <li>Talk through your thought process so your evaluator can understand how you're solving the problem.</li>
      </ul>

      <button id="reset-password">Reset Passphrase</button>

      <hr />

      <h4>kmToMiles</h4>
      <p>
        Define a function named <code>kmToMiles</code> that receives one parameter:
      </p>
      <ol>
        <li>km - <em>type: number</em></li>
      </ol>
      <p>
        The function should return a number in miles, <strong>rounded down</strong> to the nearest integer. 
      </p>
      <p>
        <em>HINT</em>: There are 1.6km in 1 mile.<br />
        <em>HINT</em>: What method on Javascript's <code>Math</code> object can round decimals down to the nearest whole number?
      </p>
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
        <input type="submit" />
      </form>
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
      const firstLine = $(el).text().split('\n')[0]
      $(el).text(firstLine);
    });
  });
}

const render = function() {
  if (state.validToken) {
    $('.directions').html(Templates.instructions());
  } else {
    $('.directions').html(Templates.passPrompt());
  }

  if (state.error) {
    $('.directions .error').text(state.error);
  } else {
    $('.error').remove();
  }
}

const fetchTests = function(token) {
  const url = new URL('http://localhost:8080/api/tests');
  url.searchParams.set('token', token);

  return $.ajax({
    method: 'GET',
    url,
  });
}

const main = function() {
  if (localStorage.getItem('thinkful-eval-token')) {
    state.validToken = localStorage.getItem('thinkful-eval-token');
    fetchTests(state.validToken)
      .then(tests => {
        eval(tests);
        runMocha();
        render();
      })
  }

  render();

  $('.directions').on('submit', '#password-form', e => {
    e.preventDefault();
    const token = $('#password-form-password').val();

    fetchTests(token)
      .then(tests => {
        localStorage.setItem('thinkful-eval-token', token);
        state.validToken = token;
        eval(tests);
        runMocha();
        render();
      })

      .catch(err => {
        if (err.status === 401) {
          state.error = 'Incorrect passphrase';
          render();
        }
      });
  });

  $('.directions').on('click', '#reset-password', e => {
    localStorage.removeItem('thinkful-eval-token');
    state.validToken = null;
    render();
  });
};

$(main);
