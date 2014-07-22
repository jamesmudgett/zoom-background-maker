app.controller('OrderCtrl', function($rootScope, $scope, $routeParams, $location, $timeout, $q, data) {
  'use strict';

  var model = $scope.model || {};

  model.order = model.order || {};
  model.shipping = {};

  model.order.card = {
    number: '',
    exp: '',
    csc: '',
    type: ''
  };

  model.countries = [
    {
      name: 'USA',
      id: 'United States'
    },
    {
      name: 'Canada',
      id: 'Canada'
    }
  ];


  model.selectedSuggestion = 0;
  model.addressError = false;
  model.error = '';
  model.orderLoading = false;
  model.orderSuccess = false;

  model.orderData = {};

  model.order.country = model.countries[0];
  model.order.shippingDetailsType = 'same';
  model.order.shippingDetailsCustom = false;
  model.order.selectedOffer = false;

  model.shippingRates = [];
  model.selectedShippingRate = [];

  model.shipping.country = model.countries[0];

  model.regions = data.model.regions;

  $scope.ImageUrl = function(url) {
    return data.printchompUrl + url;
  };

  var loadOffers = function() {
    data.GetOffers().then(function(offers) {
      model.offers = offers.offers;

      // select the first order
      model.order.selectedOffer = 0;
    }, function() {
      // in case the api is down
      // retry in 3s
      $timeout(loadOffers, 3000);
    });
  };

  loadOffers();

  $scope.$watch('model.order.country', function() {
    model.order.region = model.regions[model.order.country.id][0];
  });

  $scope.$watch('model.shipping.country', function() {
    model.shipping.region = model.regions[model.shipping.country.id][0];
  });

  $scope.$watch('model.order.shippingDetailsType', function() {
    if(model.order.shippingDetailsType === 'custom') {
      model.order.shippingDetailsCustom = true;
    } else {
      model.order.shippingDetailsCustom = false;
    }
  });

  // local testing
  if(data.env === 'local' || data.env === 'dev') {
    model.order.city = 'Florence';
    model.order.postcode = '35630';
    model.order.address1 = '110 West College Street';
    model.order.card.number = '4030000010001234';
    model.order.card.exp = '6 / 2016';
    model.order.card.csc = '123';
  }

  var parseAddress = function(model) {
    var address = {};

    address.city = model.city;
    address.region = model.region.id;
    address.country = model.country.id;
    address.postal_code = model.postcode;
    address.street = model.address1;
    address.street2 = model.address2 || '';

    return address;
  };

  $scope.SendOrder = function(event) {

    var $modalOrder = $('#modal-order');

    // scroll to modal top
    var scrollToModal = function() {
      $modalOrder[0].scrollIntoView(true);
    };

    // make sure the form is valid
    if(!$scope.orderForm.$valid) {

      // find the invalid field and focus it
      var firstInvalid = angular.element('#orderForm .ng-invalid');

      // get the field model
      var fieldModel = firstInvalid.attr('ng-model');

      var errorLabel = 'Invalid ' + fieldModel + ' order form field.';

      // track analytics
      ga('send', 'event', 'Orders', 'Invalid order form', errorLabel);

      // if we find one, set focus
      if (firstInvalid[0]) {
        firstInvalid[0].focus();
      }

      // prevent form submission
      return event.preventDefault();
    }

    model.orderLoading = true;

    // generate base64 picture
    model.orderData.image = model.imagePreview;

    // user details
    model.orderData.user = {
      email: model.order.email,
      name: model.order.name
    };

    // billing details
    model.orderData.billing = {};
    model.orderData.billing.name = model.order.name;
    model.orderData.billing.phone = model.order.phone;

    // billing address
    model.orderData.billing.address = parseAddress(model.order);

    // offer details
    model.orderData.billing.amount = angular.copy(model.offers[model.order.selectedOffer].amount);

    model.orderData.offer = {};
    model.orderData.offer.id = model.offers[model.order.selectedOffer].id;

    // payment details
    model.orderData.billing.credit_card = {};
    model.orderData.billing.credit_card.number = model.order.card.number.replace(/ /g, '');
    model.orderData.billing.credit_card.verification = model.order.card.csc;

    var exp = model.order.card.exp.replace(/ /g, '').split('/');
    model.orderData.billing.credit_card.expiry = {};
    model.orderData.billing.credit_card.expiry.month = exp[0];

    // if year is only two digits, prepend 20
    if(exp[1].length === 2) {
      exp[1] = '20' + exp[1];
    }

    model.orderData.billing.credit_card.expiry.year = exp[1];

    // shipping details
    model.orderData.shipping = {};
    if(model.order.shippingDetailsCustom) {

      model.orderData.shipping.name = model.shipping.name;
      model.orderData.shipping.phone = model.shipping.phone;

      model.orderData.shipping.address = parseAddress(model.shipping);

    } else {

      model.orderData.shipping.name = model.orderData.billing.name;
      model.orderData.shipping.phone = model.orderData.billing.phone;
      model.orderData.shipping.address = model.orderData.billing.address;

    }

    // validate address if not validated already
    if(model.addressError) {

      model.orderData.validate_address = false;

      // set shipping details from address suggestions
      var validatedAddress = model.addressError.suggestions[model.selectedSuggestion];

      var addressComponent = {
        streetNumber: '',
        street: '',
        city: '',
        region: '',
        country: '',
        postal_code: ''
      };

      angular.forEach(validatedAddress.address_components, function(addr) {

        angular.forEach(addr.types, function(type) {

          if(type === 'street_number') {
            return addressComponent.streetNumber = addr.long_name || addr.short_name;
          }

          if(type === 'route') {
            return addressComponent.street = addr.long_name || addr.short_name;
          }

          if(type === 'locality') {
            return addressComponent.city = addr.long_name || addr.short_name;
          }

          if(type === 'administrative_area_level_1') {
            return addressComponent.region = addr.short_name;
          }

          if(type === 'country') {
            return addressComponent.country = addr.long_name || addr.short_name;
          }

          if(type === 'postal_code') {
            return addressComponent.postal_code = addr.long_name || addr.short_name;
          }

        });

      });

      model.orderData.shipping.address.city = addressComponent.city;
      model.orderData.shipping.address.region = addressComponent.region;
      model.orderData.shipping.address.country = addressComponent.country;
      model.orderData.shipping.address.postal_code = addressComponent.postal_code;
      model.orderData.shipping.address.street = addressComponent.streetNumber + ' ' + addressComponent.street;
      model.orderData.shipping.address.street2 = '';

    } else {

      model.orderData.validate_address = true;

    }

    model.addressError = false;

    data.SendOrder(model.orderData).then(function() {

      // scroll to modal top
      // so the users sees the success messages
      scrollToModal();

      model.orderLoading = false;

      model.addressError = false;
      model.error = '';
      model.orderSuccess = true;

      // hide the modal in 5s
      $timeout(function() {
        $modalOrder.foundation('reveal', 'close');
      }, 5000);

      // track analytics
      ga('send', 'event', 'Orders', 'Successful order', model.orderData.offer.id);

    }, function(err) {

      // scroll to top to see errors
      scrollToModal();

      model.orderLoading = false;

      if(err.addressError) {
        model.addressError = err.addressError;

        // track analytics
        ga('send', 'event', 'Orders', 'Address error');

      } else {

        model.error = err.error || 'Please try again later.';

        // track analytics
        ga('send', 'event', 'Orders', 'Order error', model.error);

      };


    });

    // scroll to top to see loading
    scrollToModal();

    // prevent form submission
    // for some weird reason, angular doesn't prevent submission automatically
    // only after I do a regular submit and a ? search param is set
    event.preventDefault();

  };

  $scope.ManualUpload = function() {

    $scope.$watch('model.manualUploadFile', function() {

      if(model.manualUploadFile) {

        var imageType = /image.*/;

        if (model.manualUploadFile.type.match(imageType)) {
          var reader = new FileReader();

          reader.onload = function() {

            $timeout(function() {
              model.imagePreview = reader.result;
            });

          };

          reader.readAsDataURL(model.manualUploadFile);

        }

      }

    });

  };

  // error message when trying to close the window
  // while order is in progress
  var TabCloseAlert = function(e) {
    if(model.orderLoading) {
      return 'Your order is currently in progress. Please wait for it to finish before closing the page. ';
    }
  };

  $scope.$watch('model.order.selectedOffer', function(selectedOffer) {

    // TODO also watch for address changes

    // TODO use debounce, or some other way to make sure the last change is the one you loaded the shipping rates for

    if(model.offers && model.offers.length) {

      var offer = model.offers[selectedOffer];

      // trigger loading
      model.shippingRates.length = 0;

      if(!offer.amount.shipping_included) {

        // shipping not included

        console.log('not included');

        var shippingRates = model.order;

        // check if we have any custom shipping address
        if(model.shipping.city && model.shipping.address1) {
          shippingRates = model.shipping;
        }

        // TODO get shipping options
        data.GetShipping({
          offer: offer,
          address: parseAddress(shippingRates)
        })
        .then(function(res) {

          console.log(res);

          model.shippingRates.length = 0;
          [].push.apply(model.shippingRates, res.rates);

        })
        .catch(function(err) {

          console.log(err);

        });

      } else {

        // shipping included

        // add empty rate to hide rates container
        [].push.apply(model.shippingRates, [{
          price: 0
        }]);

      }

    }

  });

  window.onbeforeunload = TabCloseAlert;

});
