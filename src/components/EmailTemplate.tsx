// src/components/EmailTemplate.tsx
import * as React from 'react';
import Image from 'next/image';

interface EmailTemplateProps {
  guestName: string;
  meetingTime: string;
  googleMeetLink: string;
  cancellationLink: string;
}

export const EmailTemplate: React.FC<Readonly<EmailTemplateProps>> = ({
  guestName,
  meetingTime,
  googleMeetLink,
  cancellationLink,
}) => (
  <div
    style={{
      margin: 0,
      padding: 0,
      backgroundColor: '#F3F4F6',
      borderRadius: '28px',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
      color: '#111827',
    }}
  >
    {/* Preheader (hidden) */}
    <div
      style={{
        display: 'none',
        overflow: 'hidden',
        lineHeight: '1px',
        opacity: 0,
        maxHeight: 0,
        maxWidth: 0,
      }}
    >
      Tu cita ha sido confirmada. Detalles y enlaces dentro.
    </div>

    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ backgroundColor: '#F3F4F6', padding: '24px 0' }}
    >
      <tbody>
        <tr>
          <td align="center">
            <table
              role="presentation"
              width="600"
              cellPadding={0}
              cellSpacing={0}
              style={{
                width: '600px',
                maxWidth: '90%',
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow:
                  '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
              }}
            >
              <tbody>
                {/* Header */}
                <tr>
                  <td
                    style={{
                      backgroundColor: '#1570db',
                      color: '#FFFFFF',
                      padding: '20px 24px',
                      textAlign: 'left',
                    }}
                  >
      
                    <div style={{ fontSize: '16px', opacity: 0.9 }}>
                      Confirmación de cita
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px' }}>
                      ¡Hola, {guestName}!
                    </div>
                  </td>
                </tr>

                {/* Body */}
                <tr>
                  <td style={{ padding: '24px' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '16px' }}>
                      Tu cita ha sido confirmada. Aquí tienes los detalles:
                    </p>

                    {/* Details card */}
                    <table
                      role="presentation"
                      width="100%"
                      cellPadding={0}
                      cellSpacing={0}
                      style={{
                        border: '1px solid #E5E7EB',
                        borderRadius: '10px',
                        backgroundColor: '#FAFAFA',
                        marginTop: '12px',
                        marginBottom: '20px',
                      }}
                    >
                      <tbody>
                        <tr>
                          <td style={{ padding: '16px 18px' }}>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '10px',
                              }}
                            >
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '8px',
                                  height: '8px',
                                  backgroundColor: '#10B981',
                                  borderRadius: '999px',
                                  marginRight: '10px',
                                }}
                              />
                              <span style={{ fontSize: '14px', color: '#6B7280' }}>
                                Fecha y hora
                              </span>
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: 600 }}>
                              {meetingTime}
                            </div>

                            <div
                              style={{
                                height: '1px',
                                backgroundColor: '#E5E7EB',
                                margin: '16px 0',
                              }}
                            />

                            <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
                              Videollamada
                            </div>
                            <a
                              href={googleMeetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-block',
                                backgroundColor: '#2563EB',
                                color: '#FFFFFF',
                                padding: '12px 16px',
                                borderRadius: '8px',
                                textDecoration: 'none',
                                fontWeight: 600,
                                fontSize: '14px',
                              }}
                            >
                              Unirse con Google Meet
                            </a>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Manage/Cancel */}
                    <p style={{ margin: '0 0 10px', fontSize: '14px', color: '#6B7280' }}>
                      ¿Necesitas hacer cambios?
                    </p>
                    <a
                      href={cancellationLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        padding: '10px 14px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: 600,
                        fontSize: '14px',
                        color: '#111827',
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      Gestionar mi cita
                    </a>

                    {/* Spacer */}
                    <div style={{ height: '20px' }} />

                    <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
                      Si no reconoces esta cita, ignora este correo o contáctanos.
                    </p>
                  </td>
                </tr>

                {/* Footer */}
                <tr>
                  <td
                    style={{
                      padding: '16px 24px',
                      backgroundColor: '#F9FAFB',
                      borderTop: '1px solid #E5E7EB',
                      fontSize: '12px',
                      color: '#6B7280',
                      textAlign: 'center',
                    }}
                  >
                    © {new Date().getFullYear()} MedDeFi. Todos los derechos reservados.
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);