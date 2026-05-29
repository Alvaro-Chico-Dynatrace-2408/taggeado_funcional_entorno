import { Page } from "@dynatrace/strato-components-preview/layouts";
import React from "react";
import { Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { Home } from "./pages/Home";
import { KubernetesView } from "./pages/KubernetesView";
import { NonKubernetesView } from "./pages/NonKubernetesView";
import { EntityDetailView } from "./pages/EntityDetailView";
import { BulkSearchView } from "./pages/BulkSearchView";

export const App = () => {
  return (
    <Page>
      <Page.Header>
        <Header />
      </Page.Header>
      <Page.Main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/kubernetes" element={<KubernetesView />} />
          <Route path="/non-kubernetes" element={<NonKubernetesView />} />
          <Route path="/bulk" element={<BulkSearchView />} />
          <Route path="/entity/:entityType/:entityId" element={<EntityDetailView />} />
        </Routes>
      </Page.Main>
    </Page>
  );
};
