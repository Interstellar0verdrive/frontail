/* global Tinycon:false, ansi_up:false */

window.App = (function app(window, document) {
  'use strict';

  /**
   * @type {Object}
   * @private
   */
  var _socket;

  /**
   * @type {HTMLElement}
   * @private
   */
  var _logContainer;

  /**
   * @type {HTMLElement}
   * @private
   */
  var _filterInput;

  /**
   * @type {String}
   * @private
   */
  var _filterValue = '';

  /**
   * @type {HTMLElement}
   * @private
   */
   var _pauseBtn;
   var _themeBtn;

  /**
   * @type {boolean}
   * @private
   */
   var _isPaused = false;
   var _isDark = false;

  /**
   * @type {number}
   * @private
   */
  var _skipCounter = 0;

  /**
   * @type {HTMLElement}
   * @private
   */
  var _topbar;

  /**
   * @type {HTMLElement}
   * @private
   */
  var _body;

  /**
   * @type {number}
   * @private
   */
  var _linesLimit = Math.Infinity;

  /**
   * @type {number}
   * @private
   */
  var _newLinesCount = 0;

  /**
   * @type {boolean}
   * @private
   */
  var _isWindowFocused = true;

  /**
   * @type {object}
   * @private
   */
  var _highlightConfig;

  /**
   * Hide element if doesn't contain filter value
   *
   * @param {Object} element
   * @private
   */
  var _filterElement = function(elem) {
    var pattern = new RegExp(_filterValue, 'i');
    var element = elem;
    if (pattern.test(element.textContent)) {
      element.style.display = '';
    } else {
      element.style.display = 'none';
    }
  };

  /**
   * Filter logs based on _filterValue
   *
   * @function
   * @private
   */
  var _filterLogs = function() {
    var collection = _logContainer.childNodes;
    var i = collection.length;

    if (i === 0) {
      return;
    }

    while (i) {
      _filterElement(collection[i - 1]);
      i -= 1;
    }
    window.scrollTo(0, document.body.scrollHeight);
  };

  /**
   * Set _filterValue from URL parameter `filter`
   *
   * @function
   * @private
   */
  var _setFilterValueFromURL = function(filterInput, uri) {
    var _url = new URL(uri);
    var _filterValueFromURL = _url.searchParams.get('filter');
    if (typeof _filterValueFromURL !== 'undefined' && _filterValueFromURL !== null) {
      _filterValue = _filterValueFromURL;
      filterInput.value = _filterValue; // eslint-disable-line
    }
  };

  /**
   * Set parameter `filter` in URL
   *
   * @function
   * @private
   */
  var _setFilterParam = function(value, uri) {
    var _url = new URL(uri);
    var _params = new URLSearchParams(_url.search.slice(1));
    if (value === '') {
      _params.delete('filter');
    } else {
      _params.set('filter', value);
    }
    _url.search = _params.toString();
    window.history.replaceState(null, document.title, _url.toString());
  };

  /**
   * @return void
   * @private
   */
  var _faviconReset = function() {
    _newLinesCount = 0;
    Tinycon.setBubble(0);
  };

  /**
   * @return void
   * @private
   */
  var _updateFaviconCounter = function() {
    if (_isWindowFocused || _isPaused) {
      return;
    }

    if (_newLinesCount < 99) {
      _newLinesCount += 1;
      Tinycon.setBubble(_newLinesCount);
    }
  };

  /**
   * @return String
   * @private
   */
  var _highlightWord = function(line) {
    var output = line;
    var regex;
    var regexG;

    if (_highlightConfig && _highlightConfig.words) {
      Object.keys(_highlightConfig.words).forEach((wordCheck) => {
        output = output.replaceAll(
          wordCheck,
          '<span style="' + _highlightConfig.words[wordCheck] + '">' + wordCheck + '</span>',
        );
      });
    }
// ----------- ADDED LINES FROM HERE ...  -----------
    if (_highlightConfig && _highlightConfig.wordsRegExClass) {
      Object.keys(_highlightConfig.wordsRegExClass).forEach((wordsRegExClassCheck) => {
        regexG = new RegExp(wordsRegExClassCheck, 'g');
        output = output.replaceAll(
          regexG,
          '<span class="' + _highlightConfig.wordsRegExClass[wordsRegExClassCheck] + '">$&</span>'
        );
      });
    }

    if (_highlightConfig && _highlightConfig.wordsRegExMatchClass) {
      Object.keys(_highlightConfig.wordsRegExMatchClass).forEach((wordsRegExMatchClassCheck) => {
        regex = new RegExp(wordsRegExMatchClassCheck);
        if(regex.test(output)) {
          // console.log('PASSED: ' + output);
          output = output.replace(
            output.match(regex)[1],
            '<span class="' + _highlightConfig.wordsRegExMatchClass[wordsRegExMatchClassCheck] + '">$&</span>'
          );
        }
      });
    }
// ----------- ... TO HERE ----------------------

    return output;
  };

  /**
   * @return HTMLElement
   * @private
   */
  var _highlightLine = function(line, container) {
    if (_highlightConfig && _highlightConfig.lines) {
      Object.keys(_highlightConfig.lines).forEach((lineCheck) => {
        if (line.indexOf(lineCheck) !== -1) {
// ----------- REPLACED THIS LINE: ---------------
         // container.setAttribute('style', _highlightConfig.lines[lineCheck]);
// ----------- WITH THIS LINE: -------------------
         container.setAttribute('class', _highlightConfig.lines[lineCheck]);
        }
      });
    }

    return container;
  };

  return {
    /**
     * Init socket.io communication and log container
     *
     * @param {Object} opts options
     */
    init: function init(opts) {
      var self = this;
      var retrievedTheme = localStorage.getItem('theme'); // retrieve the theme (if stored)

      // Elements
      _logContainer = opts.container;
      _filterInput = opts.filterInput;
      _filterInput.focus();
      _pauseBtn = opts.pauseBtn;
      _themeBtn = opts.themeBtn;
      _topbar = opts.topbar;
      _body = opts.body;

      _setFilterValueFromURL(_filterInput, window.location.toString());

      // Filter input bind
      _filterInput.addEventListener('keyup', function(e) {
        // ESC
        if (e.keyCode === 27) {
          this.value = '';
          _filterValue = '';
        } else {
          _filterValue = this.value;
        }
        _setFilterParam(_filterValue, window.location.toString());
        _filterLogs();
      });

      // Pause button bind
      _pauseBtn.addEventListener('mouseup', function() {
        _isPaused = !_isPaused;
        if (_isPaused) {
          this.className += ' play';
        } else {
          _skipCounter = 0;
          this.classList.remove('play');
        }
      });

// ----------- ADDED LINES FROM HERE ... --------------
      document.documentElement.setAttribute('data-theme', retrievedTheme)
      if (retrievedTheme === 'dark' ) {
        _themeBtn.classList.add('dark');
        _isDark = true;
      } else {
        _themeBtn.classList.remove('dark');
        _isDark = false;
      }
      // console.log('THEME RETRIEVED: ' + retrievedTheme);

      const trans = () => {
        document.documentElement.classList.add('transition');
        window.setTimeout(() => {
            document.documentElement.classList.remove('transition')
        }, 1000)
      };

      _themeBtn.addEventListener('mouseup', function() {
        _isDark = !_isDark;
        // console.log('I have set _isDark to: ' + _isDark)
        if(_isDark) {
          trans()
          document.documentElement.setAttribute('data-theme', 'dark')
          this.classList.add('dark');
          localStorage.setItem('theme', 'dark'); // store the theme
        } else {
          trans()
          document.documentElement.setAttribute('data-theme', 'light')
          this.classList.remove('dark');
          localStorage.setItem('theme', 'light'); // store the theme
        }
      });
// ----------- ... TO HERE ----------------------

      // Favicon counter bind
      window.addEventListener(
        'blur',
        function() {
          _isWindowFocused = false;
        },
        true,
      );
      window.addEventListener(
        'focus',
        function() {
          _isWindowFocused = true;
          _faviconReset();
        },
        true,
      );

      // socket.io init
      _socket = opts.socket;
      _socket
        .on('options:lines', function(limit) {
          _linesLimit = limit;
        })
        .on('options:hide-topbar', function() {
          _topbar.className += ' hide';
          _body.className = 'no-topbar';
        })
        .on('options:no-indent', function() {
          _logContainer.className += ' no-indent';
        })
        .on('options:highlightConfig', function(highlightConfig) {
          _highlightConfig = highlightConfig;
        })
        .on('line', function(line) {
          if (_isPaused) {
            _skipCounter += 1;
// ----------- REPLACED THIS LINE: -----------------
            // self.log('==> SKIPPED: ' + _skipCounter + ' <==', (_skipCounter > 1));
// ----------- WITH THIS LINE: ---------------------
            self.log('SKIPPED: ' + _skipCounter, (_skipCounter > 1));
          } else {
            self.log(line);
          }
        });
    },

    /**
     * Log data
     *
     * @param {string} data data to log
     */
    log: function log(data, replace = false) {
      var wasScrolledBottom = window.innerHeight + Math.ceil(window.pageYOffset + 1)
        >= document.body.offsetHeight;
      var div = document.createElement('div');
      var p = document.createElement('p');
      p.className = 'inner-line';

      // convert ansi color codes to html && escape HTML tags
      data = ansi_up.escape_for_html(data); // eslint-disable-line
      data = ansi_up.ansi_to_html(data); // eslint-disable-line
      p.innerHTML = _highlightWord(data);

      div.className = 'line';
      div = _highlightLine(data, div);
      div.addEventListener('click', function click() {
// ----------- REPLACED THESE LINES: --------------------
        // if (this.className.indexOf('selected') === -1) {
        //   this.className = 'line-selected';
        // } else {
        //   this.className = 'line';
        // }
// ----------- WITH THIS LINE: --------------------------
        this.classList.toggle("line-selected");
      });

      div.appendChild(p);
      _filterElement(div);
      if (replace) {
        _logContainer.replaceChild(div, _logContainer.lastChild);
      } else {
        _logContainer.appendChild(div);
      }

      if (_logContainer.children.length > _linesLimit) {
        _logContainer.removeChild(_logContainer.children[0]);
      }

      if (wasScrolledBottom) {
        window.scrollTo(0, document.body.scrollHeight);
      }

      _updateFaviconCounter();
    },
  };
}(window, document));
