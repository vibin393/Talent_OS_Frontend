"use client";

import { Field, Input, Spinner, Text } from "@fluentui/react-components";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "@/lib/api/errors";
import { portalReceivablesApi, receivablesKeys } from "./api";
import { useRcvStyles } from "./components";
import { todayIso } from "./logic";
import { StatementTable } from "./tools-views";

/** Client Portal `/client/statement`: the client's own statement of account (mobile-first). */
export function ClientStatement() {
  const s = useRcvStyles();
  const [start, setStart] = useState(`${todayIso().slice(0, 4)}-04-01`);
  const [end, setEnd] = useState(todayIso());
  const q = useQuery({
    queryKey: receivablesKeys.portalStatement(start, end, "INR"),
    queryFn: ({ signal }) => portalReceivablesApi.statement(start, end, "INR", signal),
    enabled: !!start && !!end,
  });
  return (
    <div className={s.page}>
      <div className={s.row}>
        <Field label="From">
          <Input type="date" value={start} onChange={(_, d) => setStart(d.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={end} onChange={(_, d) => setEnd(d.value)} />
        </Field>
      </div>
      {q.data ? <StatementTable data={q.data} /> : q.error ? <Text>{errorMessage(q.error)}</Text> : <Spinner />}
    </div>
  );
}
