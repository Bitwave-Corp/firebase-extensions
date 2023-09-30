import * as firebase from "firebase-admin";
import { CliConfig, SerializableQuery, QueryOptions } from "./types";
import { worker } from "workerpool";

import {
  ChangeType,
  FirestoreBigQueryEventHistoryTracker,
  FirestoreDocumentChangeEvent,
} from "@firebaseextensions/firestore-bigquery-change-tracker";
import * as _ from "lodash";

async function processDocuments(
  serializableQuery: SerializableQuery,
  config: CliConfig
) {
  try {
    // process.memoryUsage();
    console.log(process.memoryUsage());

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

    const dataSink = new FirestoreBigQueryEventHistoryTracker({
      tableId,
      datasetId,
      datasetLocation,
    });

    const chunks = _.chunk(docs, config.batchSize);

    let total = 0;

    for(const chunk of chunks) {
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
      total += rows.length
    }

    return total;
  } catch (e) {
    throw e;
  }
}

worker({
  processDocuments: processDocuments,
});
