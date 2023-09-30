import * as firebase from "firebase-admin";
import { CliConfig, SerializableQuery, QueryOptions } from "./types";
import { worker } from "workerpool";

import {
  ChangeType,
  FirestoreBigQueryEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
import * as _ from "lodash";
import * as v8 from "v8";

const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;


async function processDocuments(
  serializableQuery: SerializableQuery,
  config: CliConfig
) {
  async function recordRows(tableId: string, datasetId: string, datasetLocation: string, chunk: any, projectId: string) {
    const dataSink = new FirestoreBigQueryEventHistoryTracker({
      tableId,
      datasetId,
      datasetLocation,
    });


    const rows: FirestoreDocumentChangeEvent = chunk.map((document) => {
      return {
        timestamp: new Date().toISOString(),
        operation: ChangeType.IMPORT,
        documentName: `projects/${projectId}/databases/(default)/documents/${document.ref.path}`,
        documentId: document.id,
        eventId: "",
        data: document.data(),
      };
    });

    await dataSink.record(rows);
    return rows;
  }

  try {
    const {
      sourceCollectionPath,
      projectId,
      tableId,
      datasetId,
      datasetLocation,
    } = config;

    if (!firebase.apps.length) {
      // Initialize Firebase
      firebase.initializeApp({
        credential: firebase.credential.applicationDefault(),
        databaseURL: `https://${projectId}.firebaseio.com`,
      });
    }

    const query = firebase
        .firestore()
        .collectionGroup(sourceCollectionPath)
        .orderBy(firebase.firestore.FieldPath.documentId(), "asc") as QueryOptions;

    query._queryOptions.startAt = serializableQuery.startAt;
    query._queryOptions.endAt = serializableQuery.endAt;
    query._queryOptions.limit = serializableQuery.limit;
    query._queryOptions.offset = serializableQuery.offset;

    const { docs } = await query.get();

    console.log(
        `worker got ${docs.length} docs, starting at ${docs[0].id} and ending at ${
            docs[docs.length - 1].id
        }`
    );


    const chunks = _.chunk(docs, config.batchSize);

    let total = 0;

    for(const chunk of chunks) {
      const rows = await recordRows(tableId, datasetId, datasetLocation, chunk, projectId);
      total += rows.length
    }

    return total;
  } catch (e) {
    console.log('Problem inserting: ', e);
    throw e;
  }
}

worker({
  processDocuments: processDocuments,
});
