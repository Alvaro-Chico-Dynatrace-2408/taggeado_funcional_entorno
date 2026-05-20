import React from "react";
import { Link } from "react-router-dom";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Text } from "@dynatrace/strato-components/typography";

export const Home = () => {
  return (
    <Flex flexDirection="column" gap={0}>
      {/* ── Hero banner ── */}
      <Flex
        flexDirection="column"
        gap={12}
        style={{
          background: "linear-gradient(135deg, #0A1628 0%, #0D2B5E 40%, #1496FF 80%, #47B0FF 100%)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
          paddingTop: 32,
          paddingBottom: 32,
          paddingLeft: 36,
          paddingRight: 36,
        }}
      >
        <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(71, 176, 255, 0.2)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -25, right: 80, width: 90, height: 90, borderRadius: "50%", background: "rgba(20, 150, 255, 0.25)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 10, right: 180, width: 50, height: 50, borderRadius: "50%", background: "rgba(71, 176, 255, 0.12)", pointerEvents: "none" }} />

        <Flex alignItems="center" gap={12}>
          <Flex
            alignItems="center"
            justifyContent="center"
            style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(255,255,255,0.15)" }}
          >
            <Text style={{ fontSize: "22px" }}>🏷️</Text>
          </Flex>
          <Flex flexDirection="column" gap={2}>
            <Heading level={2} style={{ color: "#fff", margin: 0 }}>
              Taggeado Funcional
            </Heading>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
              Identifica la AppFuncional (AF) de cualquier entidad de infraestructura
            </Text>
          </Flex>
        </Flex>
      </Flex>

      {/* ── Content area ── */}
      <Flex
        flexDirection="column"
        alignItems="center"
        gap={40}
        style={{ padding: "48px 24px" }}
      >
        {/* Two section cards */}
        <Flex gap={32} style={{ flexWrap: "wrap" }} justifyContent="center">
          <Link to="/kubernetes" style={{ textDecoration: "none", color: "inherit" }}>
            <Flex
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              gap={16}
              style={{
                width: 300,
                height: 200,
                borderRadius: "14px",
                background: "linear-gradient(135deg, #1a0a3e 0%, #6b2fff 100%)",
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
                boxShadow: "0 8px 32px rgba(107, 47, 255, 0.25)",
                padding: "32px",
              }}
            >
              <Text style={{ fontSize: "42px" }}>☸️</Text>
              <Text style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>
                Kubernetes
              </Text>
              <Text style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", textAlign: "center" }}>
                Cluster · Namespace · Workload · Pod
              </Text>
            </Flex>
          </Link>

          <Link to="/non-kubernetes" style={{ textDecoration: "none", color: "inherit" }}>
            <Flex
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              gap={16}
              style={{
                width: 300,
                height: 200,
                borderRadius: "14px",
                background: "linear-gradient(135deg, #0a2e1a 0%, #1b5e20 100%)",
                cursor: "pointer",
                transition: "transform 0.2s, box-shadow 0.2s",
                boxShadow: "0 8px 32px rgba(27, 94, 32, 0.25)",
                padding: "32px",
              }}
            >
              <Text style={{ fontSize: "42px" }}>🖥️</Text>
              <Text style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>
                No-Kubernetes
              </Text>
              <Text style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", textAlign: "center" }}>
                Host · Process Group · Service
              </Text>
            </Flex>
          </Link>
        </Flex>

        {/* Footer note */}
        <Text style={{ fontSize: "12px", opacity: 0.5, maxWidth: 500, textAlign: "center" }}>
          La tag AppFuncional_DatalakeInfo se resuelve automáticamente:
          directa en Hosts/Namespaces, heredada en entidades hijas.
        </Text>
      </Flex>
    </Flex>
  );
};
