// Copyright 2016 Google Inc.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//      http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


(function() {
  'use strict';

  var app = {
    isLoading: true,
    visibleCards: {},
    selectedCities: [],
    spinner: document.querySelector('.loader'),
    cardTemplate: document.querySelector('.cardTemplate'),
    container: document.querySelector('.main'),
    addDialog: document.querySelector('.dialog-container'),
    daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  };


  /*****************************************************************************
   *
   * Event listeners for UI elements
   *
   ****************************************************************************/

  document.getElementById('butRefresh').addEventListener('click', function() {
    // Refresh all of the forecasts
    app.updateForecasts();
  });

  document.getElementById('butAdd').addEventListener('click', function() {
    // Open/show the add new city dialog
    app.toggleAddDialog(true);
  });

  document.getElementById('butAddCity').addEventListener('click', function() {
    // Add the newly selected city
    var select = document.getElementById('selectCityToAdd');
    var selected = select.options[select.selectedIndex];
    var key = selected.value;
    var label = selected.textContent;
    if (!app.selectedCities) {
      app.selectedCities = [];
    }
    app.getForecast(key, label);
    app.selectedCities.push({key: key, label: label});
    app.saveSelectedCities();
    app.toggleAddDialog(false);
  });

  document.getElementById('butAddCancel').addEventListener('click', function() {
    // Close the add new city dialog
    app.toggleAddDialog(false);
  });


  /*****************************************************************************
   *
   * Methods to update/refresh the UI
   *
   ****************************************************************************/

  // Toggles the visibility of the add new city dialog.
  app.toggleAddDialog = function(visible) {
    if (visible) {
      app.addDialog.classList.add('dialog-container--visible');
    } else {
      app.addDialog.classList.remove('dialog-container--visible');
    }
  };

  // Updates a weather card with the latest weather forecast. If the card
  // doesn't already exist, it's cloned from the template.
  app.updateForecastCard = function(data) {
    var dataLastUpdated = new Date(data.created);
    var sunrise = data.forecast.forecastday[0].astro.sunrise;
    var sunset = data.forecast.forecastday[0].astro.sunset;
    var humidity = data.current.humidity;
    var wind = data.current.wind_mph;
    var windspeed = data.current.wind_degree;
    var currentCondition = data.current.condition.text;
    var date = data.location.localtime;
    var icon = data.current.condition.code;
    var currentTemp = data.current.temp_f;

    var card = app.visibleCards[data.key];
    if (!card) {
      card = app.cardTemplate.cloneNode(true);
      card.classList.remove('cardTemplate');
      card.querySelector('.location').textContent = data.location.name;
      card.removeAttribute('hidden');
      app.container.appendChild(card);
      app.visibleCards[data.key] = card;
    }

    // Verifies the data provide is newer than what's already visible
    // on the card, if it's not bail, if it is, continue and update the
    // time saved in the card
    var cardLastUpdatedElem = card.querySelector('.card-last-updated');
    var cardLastUpdated = cardLastUpdatedElem.textContent;
    if (cardLastUpdated) {
      cardLastUpdated = new Date(cardLastUpdated);
      // Bail if the card has more recent data then the data
      if (dataLastUpdated.getTime() < cardLastUpdated.getTime()) {
        return;
      }
    }
    cardLastUpdatedElem.textContent = data.created;


    card.querySelector('.description').textContent = currentCondition;
    card.querySelector('.date').textContent = date;
    card.querySelector('.current .icon').classList.add(app.getIconClass(icon));
    card.querySelector('.current .temperature .value').textContent =
      Math.round(currentTemp);
    card.querySelector('.current .sunrise').textContent = sunrise;
    card.querySelector('.current .sunset').textContent = sunset;
    card.querySelector('.current .humidity').textContent =
      Math.round(humidity) + '%';
    card.querySelector('.current .wind .value').textContent =
      Math.round(wind);
    card.querySelector('.current .wind .direction').textContent = windspeed;
    var nextDays = card.querySelectorAll('.future .oneday');
    var today = new Date();
    today = today.getDay();
    for (var i = 0; i < 7; i++) {
      var nextDay = nextDays[i];
      var daily = data.forecast.forecastday[i];
      if (daily && nextDay) {
        nextDay.querySelector('.date').textContent =
          app.daysOfWeek[(i + today) % 7];
        nextDay.querySelector('.icon').classList.add(app.getIconClass(daily.day.condition.code));
        nextDay.querySelector('.temp-high .value').textContent =
          Math.round(daily.day.maxtemp_f);
        nextDay.querySelector('.temp-low .value').textContent =
          Math.round(daily.day.mintemp_f);
      }
    }
    if (app.isLoading) {
      app.spinner.setAttribute('hidden', true);
      app.container.removeAttribute('hidden');
      app.isLoading = false;
    }
  };


  /*****************************************************************************
   *
   * Methods for dealing with the model
   *
   ****************************************************************************/

  /*
   * Gets a forecast for a specific city and updates the card with the data.
   * getForecast() first checks if the weather data is in the cache. If so,
   * then it gets that data and populates the card with the cached data.
   * Then, getForecast() goes to the network for fresh data. If the network
   * request goes through, then the card gets updated a second time with the
   * freshest data.
   */
  app.getForecast = function(key, label) {
    var statement = key + '&days=7';
    var url = 'https://api.apixu.com/v1/forecast.json?key=2a56fd72c41f4ead976234428192903&q=' +
        statement;
    // TODO add cache logic here
    if ('caches' in window) {
      /*
       * Check if the service worker has already cached this city's weather
       * data. If the service worker has the data, then display the cached
       * data while the app fetches the latest data.
       */
      caches.match(url).then(function(response) {
        if (response) {
          response.json().then(function updateFromCache(json) {
            var results = json.query.results;
            results.key = key;
            results.label = label;
            results.created = json.query.created;
            app.updateForecastCard(results);
          });
        }
      });
    }

    // Fetch the latest data.
    var request = new XMLHttpRequest();
    request.onreadystatechange = function() {
      if (request.readyState === XMLHttpRequest.DONE) {
        if (request.status === 200) {
          var response = JSON.parse(request.response);
          var results = {
            current: response.current,
            forecast: response.forecast,
            location: response.location
          }
          results.key = key;
          results.label = label;
          results.created = new Date().getUTCDay();
          app.updateForecastCard(results);
        }
      } else {
        // Return the initial weather forecast since no data is available.
        app.updateForecastCard(initialWeatherForecast);
      }
    };
    request.open('GET', url);
    request.send();
  };

  // Iterate all of the cards and attempt to get the latest forecast data
  app.updateForecasts = function() {
    var keys = Object.keys(app.visibleCards);
    keys.forEach(function(key) {
      app.getForecast(key);
    });
  };

  // TODO add saveSelectedCities function here

  // Save list of cities to localStorage.
  app.saveSelectedCities = function() {
    var selectedCities = JSON.stringify(app.selectedCities);
    localStorage.selectedCities = selectedCities;
  };

  app.getIconClass = function(weatherCode) {
    // Weather codes: https://developer.yahoo.com/weather/documentation.html#codes
    weatherCode = parseInt(weatherCode);
    switch (weatherCode) {
      case 1000: // sunny
      case 3200: // not available
        return 'clear-day';
      case 1063: // tornado
      case 1180: // hurricane
      case 1171: // mixed rain and sleet
      case 1168: // freezing drizzle
      case 1153: // drizzle
      case 1072: // freezing rain
      case 1150: // showers
      case 1183: // showers
      case 1186: // hail
      case 1189: // mixed rain and hail
      case 1192: // scattered showers
      case 1195: // rain
      case 1198: // rain
      case 2001: // rain
      case 1204:
      case 1207:
      case 1240:
      case 1243:
      case 1246:
      case 1252:
      case 1273:
      case 1276:
        return 'rain';
      case 1087:
        return 'thunderstorms';
      case 1066: // mixed rain and snow
      case 1114: // mixed snow and sleet
      case 1117: // snow flurries
      case 1210: // light snow showers
      case 1213: // snow
      case 1216: // sleet
      case 1219: // heavy snow
      case 1222: // scattered snow showers
      case 1225: // heavy snow
      case 1237: // snow showers
      case 1255:
      case 1258:
      case 1261:
      case 1264:
      case 1279:
      case 1282:
        return 'snow';
      case 1147: // dust
      case 1135: // foggy
        return 'fog';
      case 1030:
      case 1006: // cloudy
      case 1009: // mostly cloudy (night)
        return 'cloudy';
      case 1003: // partly cloudy (night)
        return 'partly-cloudy-day';
    }
  };

  /*
   * Fake weather data that is presented when the user first uses the app,
   * or when the user has not saved any cities. See startup code for more
   * discussion.
   */
  var initialWeatherForecast = {
    key: 'Salzburg',
    label: 'Salzburg',
    created: '2016-07-22T01:00:00Z',
    current: {
      condition: {
        code: 1003,
        text: "Partly cloudy"
      },
      wind_mph: 2.5,
      wind_degree: 130,
      humidity: 87,
      temp_f: 35.6
    },
    forecast: {
      forecastday: [
        {date: "2019-03-30", date_epoch: 1553904000, day: {maxtemp_f: 64, mintemp_f: 34.3, condition: {code: 1003}}, astro: {sunrise: "05:52 AM", sunset: "06:34 PM"}},
        {date: "2019-03-31", date_epoch: 1553990400, day: {maxtemp_f: 69, mintemp_f: 31.3, condition: {code: 2001}}, astro: {sunrise: "05:56 AM", sunset: "06:35 PM"}},
        {date: "2019-04-01", date_epoch: 1554076800, day: {maxtemp_f: 62, mintemp_f: 33.3, condition: {code: 1006}}, astro: {sunrise: "05:50 AM", sunset: "06:37 PM"}},
        {date: "2019-04-02", date_epoch: 1554163200, day: {maxtemp_f: 61, mintemp_f: 32.3, condition: {code: 1003}}, astro: {sunrise: "05:48 AM", sunset: "06:38 PM"}},
        {date: "2019-04-03", date_epoch: 1554249600, day: {maxtemp_f: 70, mintemp_f: 39.3, condition: {code: 1003}}, astro: {sunrise: "05:45 AM", sunset: "06:39 PM"}},
        {date: "2019-04-04", date_epoch: 1554336000, day: {maxtemp_f: 74, mintemp_f: 38.3, condition: {code: 1003}}, astro: {sunrise: "05:44 AM", sunset: "06:41 PM"}},
        {date: "2019-04-05", date_epoch: 1554422400, day: {maxtemp_f: 62, mintemp_f: 32.3, condition: {code: 1276}}, astro: {sunrise: "05:42 AM", sunset: "06:42 PM"}}
      ]
    },
    location: {
      localtime: "2019-03-30 4:01",
      name: 'Salzburg'
    }
  };
  // TODO uncomment line below to test app with fake data
  //app.updateForecastCard(initialWeatherForecast);

  // TODO add startup code here

  /************************************************************************
   *
   * Code required to start the app
   *
   * NOTE: To simplify this codelab, we've used localStorage.
   *   localStorage is a synchronous API and has serious performance
   *   implications. It should not be used in production applications!
   *   Instead, check out IDB (https://www.npmjs.com/package/idb) or
   *   SimpleDB (https://gist.github.com/inexorabletash/c8069c042b734519680c)
   ************************************************************************/

  app.selectedCities = localStorage.selectedCities;
  if (app.selectedCities) {
    app.selectedCities = JSON.parse(app.selectedCities);
    app.selectedCities.forEach(function(city) {
      app.getForecast(city.key, city.label);
    });
  } else {
    /* The user is using the app for the first time, or the user has not
     * saved any cities, so show the user some fake data. A real app in this
     * scenario could guess the user's location via IP lookup and then inject
     * that data into the page.
     */
    app.updateForecastCard(initialWeatherForecast);
    app.selectedCities = [
      {key: initialWeatherForecast.key, label: initialWeatherForecast.label}
    ];
    app.saveSelectedCities();
  }

  app.toggleLoginButton = function(status) {
    if(status == 'Login'){
      document.getElementById('butLogin').innerHTML = 'Logout'
    }
    else if(status == 'Logout'){
      document.getElementById('butLogin').innerHTML = 'Login'
    }
  }

  // TODO add service worker code here
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
             .register('../service-worker.js')
             .then(
               function() { 
                  console.log('Service Worker Registered.'); 
                });

    navigator.serviceWorker.addEventListener('message', function (event) {
      console.log(event.data);
      app.toggleLoginButton(event.data);
    }) 
  }

  //zuerst mit MessageChannel gemacht, und nach 3 stunden aufgegben, weil es nicht gescheid ging.

  //Login / Logout
  document.getElementById('butLogin').addEventListener('click', function() {
    app.loginUser();
  });

  app.loginUser = function() {    
    //status entweder Login oder Logout
    var status = document.getElementById('butLogin').innerHTML;
    var msg = status;
    navigator.serviceWorker.controller.postMessage(msg);
  };
})();