{{- define "roundtable-ui.fullname" -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "roundtable-ui.labels" -}}
app.kubernetes.io/name: roundtable-ui
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "roundtable-ui.selectorLabels" -}}
app.kubernetes.io/name: roundtable-ui
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "roundtable-ui.serviceAccountName" -}}
{{- if .Values.serviceAccount.name }}
{{- .Values.serviceAccount.name }}
{{- else }}
{{- include "roundtable-ui.fullname" . }}
{{- end }}
{{- end }}
