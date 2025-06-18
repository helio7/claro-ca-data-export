define(['postmonger'], (Postmonger) => {
    'use strict';

    let $ = jQuery.noConflict(); // Evitar conflicto con otras versiones de jQuery
    let connection = new Postmonger.Session();

    let activity = {};

    // Configuration variables
    let eventDefinitionKey;

    $(window).ready(() => {
        // JB will respond the first time 'ready' is called with 'initActivity'
        connection.trigger('ready');
        connection.trigger('requestTokens');
        connection.trigger('requestEndpoints');
        connection.trigger("requestTriggerEventDefinition");
        connection.trigger("requestInteraction");
    });
    connection.on('initActivity', (data) => {
        if (data) activity = data;

        const inArguments = Boolean(
            data.arguments &&
            data.arguments.execute &&
            data.arguments.execute.inArguments &&
            data.arguments.execute.inArguments.length > 0
        ) ? data.arguments.execute.inArguments : [];

        const tableNameArg = inArguments.find(arg => arg.tableName);
        if (tableNameArg) document.getElementById('tableName').value = tableNameArg.tableName;

        const fieldsArg = inArguments.find(arg => arg.fields);
        if (fieldsArg) {
            const parsedFields = JSON.parse(fieldsArg.fields);
            for (const parsedField of parsedFields) {
                addItem(
                    parsedField[0],
                    parsedField[1],
                        // .replace(/\*Fst_B\*/g, '{')
                        // .replace(/\*Lst_B\*/g, '}'),
                );
            }
        }
    });

    connection.on('clickedNext', () => {
        const tableName = document.getElementById('tableName').value;

        const groupDivs = document.querySelectorAll('.field-item');
        const fieldsObject = {};
        for (const groupDiv of groupDivs) {
            const inputs = groupDiv.querySelectorAll('input');
            for (const input of inputs) {
                let fieldName = '';
                let fieldValue = '';
                if (input.name === 'fieldName') fieldName = input.value;
                else if (input.name === 'fieldValue') {
                    fieldValue = `${input.value}`;
                    /* fieldValue = input.value
                        .replace(/{/g, '*Fst_B*') // "First brace"
                        .replace(/}/g, '*Lst_B*'); // "Last brace" */
                }
                fieldsObject[fieldName] = fieldValue;
            }
        }
        const fields = JSON.stringify(fieldsObject);

        activity['arguments'].execute.inArguments = [
            { tableName: tableName ? tableName : null },
            { fields: fields ? fields : null },
        ];

        activity['metaData'].isConfigured = true;
        connection.trigger('updateActivity', activity);
    });

    /**
     * This function is to pull out the event definition within journey builder.
     * With the eventDefinitionKey, you are able to pull out values that passes through the journey
     */
    connection.on('requestedTriggerEventDefinition', (eventDefinitionModel) => {
        console.log("Requested TriggerEventDefinition", eventDefinitionModel.eventDefinitionKey);
        if (eventDefinitionModel) eventDefinitionKey = eventDefinitionModel.eventDefinitionKey;
    });

    connection.on('requestedTriggerEventDefinition', (eventDefinitionModel) => {
        if (eventDefinitionModel) eventDefinitionKey = eventDefinitionModel.eventDefinitionKey;
    });
});
