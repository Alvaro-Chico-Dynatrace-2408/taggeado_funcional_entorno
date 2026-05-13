import React from "react";
import { Link } from "react-router-dom";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Text } from "@dynatrace/strato-components/typography";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Borders from "@dynatrace/strato-design-tokens/borders";
import BoxShadows from "@dynatrace/strato-design-tokens/box-shadows";

const SectionCard = ({ title, description, to }: { title: string; description: string; to: string }) => (
  <Link to={to} style={{ textDecoration: "none", color: "inherit" }}>
    <Flex
      flexDirection="column"
      gap={8}
      style={{
        padding: "24px",
        width: "280px",
        borderRadius: Borders.Radius.Container.Default,
        background: Colors.Background.Surface.Default,
        boxShadow: BoxShadows.Surface.Raised.Rest,
        cursor: "pointer",
        transition: "box-shadow 0.2s",
      }}
    >
      <Text style={{ fontWeight: 700, fontSize: "16px" }}>{title}</Text>
      <Text style={{ opacity: 0.7, fontSize: "13px" }}>{description}</Text>
    </Flex>
  </Link>
);

export const Home = () => {
  return (
    <Flex flexDirection="column" alignItems="center" padding={32} gap={32}>
      <Flex flexDirection="column" alignItems="center" gap={8}>
        <Heading>AF Tag Resolver</Heading>
        <Paragraph>
          Identifica la AppFuncional (AF) de cualquier entidad de infraestructura Dynatrace.
          Navega la jerarquía de entidades y resuelve la tag heredada via namespaces u hosts.
        </Paragraph>
      </Flex>

      <Flex gap={24} style={{ flexWrap: "wrap" }} justifyContent="center">
        <SectionCard
          title="🔍 Búsqueda Universal"
          description="Busca cualquier entidad por nombre y visualiza su AF resuelta"
          to="/search"
        />
        <SectionCard
          title="☸️ Kubernetes"
          description="Navega Cluster → Namespace → Workload → Pod con AF heredada del namespace"
          to="/kubernetes"
        />
        <SectionCard
          title="🖥️ No-Kubernetes"
          description="Navega Host → Process Group → Service con AF heredada del host"
          to="/non-kubernetes"
        />
      </Flex>

      <Flex
        flexDirection="column"
        gap={8}
        style={{
          marginTop: 32,
          padding: "16px 24px",
          borderRadius: "8px",
          background: Colors.Background.Field.Neutral.Emphasized,
          maxWidth: "600px",
        }}
      >
        <Text style={{ fontWeight: 600 }}>¿Cómo funciona?</Text>
        <Text style={{ fontSize: "13px" }}>
          1. Si la entidad tiene la tag <strong>AppFuncional_DatalakeInfo</strong> directamente → se muestra el valor
        </Text>
        <Text style={{ fontSize: "13px" }}>
          2. Si es una entidad K8s (Workload/Pod) → se resuelve traversando hasta el Namespace padre
        </Text>
        <Text style={{ fontSize: "13px" }}>
          3. Si es una entidad non-K8s (Service/PG) → se resuelve traversando hasta el Host padre
        </Text>
      </Flex>
    </Flex>
  );
};
