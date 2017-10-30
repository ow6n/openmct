/*****************************************************************************
 * Open MCT, Copyright (c) 2014-2017, United States Government
 * as represented by the Administrator of the National Aeronautics and Space
 * Administration. All rights reserved.
 *
 * Open MCT is licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * Open MCT includes source code licensed under additional open source
 * licenses. See the Open Source Licenses file (LICENSES.md) included with
 * this source code distribution or the Licensing information page available
 * at runtime from the About dialog for additional information.
 *****************************************************************************/

define([], function () {

    function TelemetryMeanProvider(openmct) {
        this.openmct = openmct;
    }

    TelemetryMeanProvider.prototype.canProvideTelemetry = function (domainObject) {
        return domainObject.type === 'telemetry-mean';
    };

    TelemetryMeanProvider.prototype.supportsRequest = function () {
        return false;
    }

    TelemetryMeanProvider.prototype.supportsSubscribe =
        TelemetryMeanProvider.prototype.canProvideTelemetry;

    TelemetryMeanProvider.prototype.subscribe = function (domainObject, callback) {
        var promiseForObject = this.getWrappedObject(domainObject)
        return this.subscribeToWrappedObject(promiseForObject, callback);
    };

    TelemetryMeanProvider.prototype.getWrappedObject = function (domainObject) {
        var objectId = domainObject.telemetryPoint;
        return this.openmct.objects.get(objectId);
    };

    TelemetryMeanProvider.prototype.subscribeToWrappedObject = function (promiseForObject, callback) {
        var wrappedUnsubscribe;
        var unsubscribeCalled = false;

        promiseForObject.then(function subscribe(wrappedObject) {
            if (!unsubscribeCalled && wrappedObject){
                wrappedUnsubscribe = this.subscribeToMeanValues(wrappedObject, callback);
            }
        }.bind(this));
        
        return function unsubscribe(){
            unsubscribeCalled = true;
            if (wrappedUnsubscribe !== undefined) {
                wrappedUnsubscribe();
            }
        };

    }

    TelemetryMeanProvider.prototype.subscribeToMeanValues = function (object, callback) {
        var telemetryApi = this.openmct.telemetry;
        var valueToMean = this.chooseValueToMean(object);
        var lastNData = [];
        var keysForRanges = telemetryApi.getMetadata(object).valuesForHints(['range'])
            .map(function (metadatum) {
                return metadatum.source;
            }
        );;

        return telemetryApi.subscribe(object, function (telemetryDatum) {

            lastNData.push(telemetryDatum);
            if (lastNData.length > object.samples) {
                lastNData.shift();
            }

            var meanDatum = this.calculateMeansForDatum(telemetryDatum, keysForRanges, lastNData);
            callback(meanDatum);

        }.bind(this));
    }

    TelemetryMeanProvider.prototype.calculateMeansForDatum = function (telemetryDatum, keysToMean, lastNData) {
        var meanDatum = JSON.parse(JSON.stringify(telemetryDatum));
        
        Object.keys(meanDatum).filter(function (key) {
            return keysToMean.indexOf(key) !== -1;
        }).forEach(function (key) {
            meanDatum[key] = this.calculateMean(lastNData, key);
        }.bind(this));

        return meanDatum;
    }

    TelemetryMeanProvider.prototype.calculateMean = function (lastNData, valueToMean) {
        return lastNData.reduce(function (sum, datum){
            return sum + datum[valueToMean];
        }, 0) / lastNData.length;
    };

    TelemetryMeanProvider.prototype.chooseValueToMean = function (object) {
        return 'sin';
    }

    TelemetryMeanProvider.prototype.request = function (domainObject, request) {
        throw "Historical requests not supported for Telemetry Averager";
    };

    return TelemetryMeanProvider;
});
