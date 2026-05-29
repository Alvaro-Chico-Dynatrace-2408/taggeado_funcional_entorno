import React from "react";
import { useNavigate } from "react-router-dom";

import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import Colors from "@dynatrace/strato-design-tokens/colors";
import {
  HashtagIcon,
  ContainerIcon,
  HostsIcon,
  MagnifyingGlassIcon,
  DocumentIcon,
  InformationIcon,
} from "@dynatrace/strato-icons";

/* ─── Brand palette ─── */
const DYNA_PURPLE = "#6b2fff";
const DYNA_BLUE = "#0D47A1";
const DYNA_ORANGE = "#E65100";
const DYNA_NAVY = "#0A1628";
const DYNA_K8S_ACCENT = "#9c6bff";
const DYNA_NON_K8S_ACCENT = "#43a047";

/* ─── Section header ─── */
const SectionHeader: React.FC<{
  icon: React.ReactNode;
  accentColor: string;
  title: string;
  subtitle: string;
}> = ({ icon, accentColor, title, subtitle }) => (
  <Flex
    alignItems="center"
    gap={16}
    padding={20}
    style={{
      background: `linear-gradient(135deg, ${accentColor}10 0%, ${accentColor}05 100%)`,
      borderLeft: `4px solid ${accentColor}`,
      borderRadius: 8,
    }}
  >
    <Flex
      alignItems="center"
      justifyContent="center"
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)`,
        color: "#fff",
        fontSize: 22,
        flexShrink: 0,
      }}
    >
      {icon}
    </Flex>
    <Flex flexDirection="column" gap={2}>
      <Heading level={2} style={{ margin: 0 }}>{title}</Heading>
      <Paragraph style={{ margin: 0, color: Colors.Text.Neutral.Subdued, fontSize: 13 }}>{subtitle}</Paragraph>
    </Flex>
  </Flex>
);

/* ─── Step card ─── */
const StepCard: React.FC<{
  stepNumber: number;
  icon: React.ReactNode;
  accentColor: string;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ stepNumber, icon, accentColor, title, children, actions }) => (
  <Surface>
    <Flex
      flexDirection="column"
      padding={24}
      gap={16}
      style={{
        borderTop: `3px solid ${accentColor}`,
        borderRadius: 8,
        position: "relative",
      }}
    >
      {/* Step badge */}
      <Flex
        alignItems="center"
        justifyContent="center"
        style={{
          position: "absolute",
          top: -14,
          right: 16,
          width: 28,
          height: 28,
          borderRadius: "50%",
          backgroundColor: accentColor,
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {stepNumber}
      </Flex>

      {/* Header row */}
      <Flex alignItems="center" gap={12}>
        <Flex
          alignItems="center"
          justifyContent="center"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: `${accentColor}18`,
            color: accentColor,
            fontSize: 20,
          }}
        >
          {icon}
        </Flex>
        <Heading level={3} style={{ margin: 0 }}>{title}</Heading>
      </Flex>

      {/* Body */}
      <Flex flexDirection="column" gap={8}>
        {children}
      </Flex>

      {/* Actions */}
      {actions && (
        <Flex gap={12} flexFlow="wrap" paddingTop={4}>
          {actions}
        </Flex>
      )}
    </Flex>
  </Surface>
);

export const Home = () => {
  const navigate = useNavigate();

  return (
    <Flex flexDirection="column" gap={0}>
      {/* ─── Hero banner ─── */}
      <Flex
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        gap={12}
        padding={40}
        style={{
          background: `linear-gradient(135deg, ${DYNA_NAVY} 0%, #1a0a3e 50%, ${DYNA_PURPLE} 100%)`,
          borderRadius: "0 0 16px 16px",
          color: "#fff",
          textAlign: "center",
        }}
      >
        <Flex alignItems="center" gap={12}>
          <Flex
            alignItems="center"
            justifyContent="center"
            style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(255,255,255,0.15)" }}
          >
            <HashtagIcon style={{ fontSize: 24, color: "#fff" } as React.CSSProperties} />
          </Flex>
          <Heading level={1} style={{ color: "#fff", margin: 0 }}>
            Taggeado Funcional
          </Heading>
        </Flex>
        <Paragraph
          style={{
            color: "rgba(255,255,255,0.8)",
            maxWidth: 700,
            fontSize: 15,
            lineHeight: 1.6,
          }}
        >
          Identifica la tag AppFuncional_DatalakeInfo (AF) de cualquier entidad de tu infraestructura.
          Sigue esta guía para conocer las funcionalidades de la aplicación.
        </Paragraph>
      </Flex>

      {/* ─── Steps ─── */}
      <Flex
        flexDirection="column"
        gap={32}
        paddingLeft={32}
        paddingRight={32}
        paddingTop={32}
        paddingBottom={40}
      >
        {/* ═══ SECCIÓN 1: Búsqueda de entidades ═══ */}
        <SectionHeader
          icon={<MagnifyingGlassIcon />}
          accentColor={DYNA_PURPLE}
          title="Búsqueda de entidades"
          subtitle="Busca por nombre o ID en cualquiera de las dos secciones"
        />

        <Flex gap={24} style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <StepCard
            stepNumber={1}
            icon={<ContainerIcon />}
            accentColor={DYNA_K8S_ACCENT}
            title="Kubernetes"
            actions={
              <Button
                variant="emphasized"
                onClick={() => navigate("/kubernetes")}
                style={{ backgroundColor: DYNA_K8S_ACCENT, borderColor: DYNA_K8S_ACCENT, color: "#fff" }}
              >
                <Button.Prefix><ContainerIcon /></Button.Prefix>
                Ir a Kubernetes
              </Button>
            }
          >
            <Paragraph>
              Busca entidades del ecosistema Kubernetes y resuelve la AF automáticamente por correlación con Namespaces.
            </Paragraph>
            <Flex flexDirection="column" gap={4} paddingLeft={8}>
              <Paragraph style={{ fontSize: 13 }}>• Cluster: agrega AF de todos sus Namespaces</Paragraph>
              <Paragraph style={{ fontSize: 13 }}>• Namespace: muestra AF directa de sus tags</Paragraph>
              <Paragraph style={{ fontSize: 13 }}>• Workload: hereda AF del Namespace al que pertenece</Paragraph>
              <Paragraph style={{ fontSize: 13 }}>• Node: correlaciona AF a través de los Pods que ejecuta</Paragraph>
              <Paragraph style={{ fontSize: 13 }}>• Pod: hereda AF del Namespace padre</Paragraph>
            </Flex>
          </StepCard>

          <StepCard
            stepNumber={2}
            icon={<HostsIcon />}
            accentColor={DYNA_NON_K8S_ACCENT}
            title="No-Kubernetes"
            actions={
              <Button
                variant="emphasized"
                onClick={() => navigate("/non-kubernetes")}
                style={{ backgroundColor: DYNA_NON_K8S_ACCENT, borderColor: DYNA_NON_K8S_ACCENT, color: "#fff" }}
              >
                <Button.Prefix><HostsIcon /></Button.Prefix>
                Ir a No-Kubernetes
              </Button>
            }
          >
            <Paragraph>
              Busca entidades fuera de Kubernetes. La AF se resuelve recorriendo la cadena de relaciones hasta un Namespace o Host.
            </Paragraph>
            <Flex flexDirection="column" gap={4} paddingLeft={8}>
              <Paragraph style={{ fontSize: 13 }}>• Host: correlaciona AF de los Namespaces de sus Pods</Paragraph>
              <Paragraph style={{ fontSize: 13 }}>• Process Group: hereda AF del Host donde se ejecuta</Paragraph>
              <Paragraph style={{ fontSize: 13 }}>• Service: hereda AF del Process Group que lo expone</Paragraph>
            </Flex>
          </StepCard>
        </Flex>

        {/* ═══ SECCIÓN 2: Resolución de AF ═══ */}
        <SectionHeader
          icon={<InformationIcon />}
          accentColor={DYNA_ORANGE}
          title="Resolución automática de AF"
          subtitle="La tag se resuelve directa o heredada según el tipo de entidad"
        />

        <Flex gap={24} style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <StepCard
            stepNumber={3}
            icon={<DocumentIcon />}
            accentColor={DYNA_ORANGE}
            title="Vista de Detalle"
          >
            <Paragraph>
              Haz clic en el nombre de cualquier entidad para ver su información completa.
            </Paragraph>
            <Flex flexDirection="column" gap={4} paddingLeft={8}>
              <Paragraph style={{ fontSize: 13 }}>• AF directa: tags propios de la entidad</Paragraph>
              <Paragraph style={{ fontSize: 13 }}>• AF heredada/agregada: resuelta automáticamente por relación</Paragraph>
              <Paragraph style={{ fontSize: 13 }}>• Enlace directo a Dynatrace para ver la entidad en contexto</Paragraph>
            </Flex>
          </StepCard>

          <StepCard
            stepNumber={4}
            icon={<HashtagIcon />}
            accentColor={DYNA_BLUE}
            title="¿Cómo se resuelve la AF?"
          >
            <Paragraph>
              La tag AppFuncional_DatalakeInfo se propaga a través de la jerarquía de entidades.
            </Paragraph>
            <Flex flexDirection="column" gap={4} paddingLeft={8}>
              <Paragraph style={{ fontSize: 13 }}>• Directa: la entidad tiene el tag en sus propios metadatos</Paragraph>
              <Paragraph style={{ fontSize: 13 }}>• Heredada: se busca en Namespaces, Hosts o entidades padre</Paragraph>
              <Paragraph style={{ fontSize: 13 }}>• Agregada: Clusters y Nodes acumulan AF de múltiples Namespaces</Paragraph>
            </Flex>
          </StepCard>
        </Flex>

        {/* ═══ SECCIÓN 3: Búsqueda masiva ═══ */}
        <SectionHeader
          icon={<DocumentIcon />}
          accentColor={DYNA_BLUE}
          title="Búsqueda Masiva"
          subtitle="Resuelve la AF de cientos de entidades a la vez subiendo un fichero de IDs"
        />

        <Flex gap={24} style={{ display: "grid", gridTemplateColumns: "1fr" }}>
          <StepCard
            stepNumber={5}
            icon={<DocumentIcon />}
            accentColor={DYNA_BLUE}
            title="Resolución masiva por fichero"
            actions={
              <Button
                variant="emphasized"
                onClick={() => navigate("/bulk")}
                style={{ backgroundColor: DYNA_BLUE, borderColor: DYNA_BLUE, color: "#fff" }}
              >
                <Button.Prefix><DocumentIcon /></Button.Prefix>
                Ir a Búsqueda Masiva
              </Button>
            }
          >
            <Paragraph>
              Sube un fichero .txt con IDs de entidades (un ID por línea) y obtén la AF directa y heredada de todas en un solo paso.
            </Paragraph>
            <Flex flexDirection="column" gap={4} paddingLeft={8}>
              <Paragraph style={{ fontSize: 13 }}>• Selecciona el tipo de entidad (Host, Service, Namespace, Application...)</Paragraph>
              <Paragraph style={{ fontSize: 13 }}>• Sube un fichero .txt con hasta 500 IDs</Paragraph>
              <Paragraph style={{ fontSize: 13 }}>• Visualiza AF directa y heredada en una tabla de resultados</Paragraph>
              <Paragraph style={{ fontSize: 13 }}>• Exporta los resultados a CSV para su análisis</Paragraph>
            </Flex>
          </StepCard>
        </Flex>
      </Flex>
    </Flex>
  );
};
