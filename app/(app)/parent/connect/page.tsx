"use client";

import { useState } from "react";

export default function ParentConnectPage() {
  const [showAddStudentForm, setShowAddStudentForm] = useState(false);

  // Sample data - in production, fetch from database
  const connectedStudents = [
    {
      id: "1",
      studentName: "Sarah Chen",
      studentEmail: "sarah.chen@example.com",
      relationship: "Mother",
      isPrimary: true,
      grade: "11th",
      chapterName: "Philadelphia",
      canViewProgress: true,
      canReceiveReports: true,
      approvedAt: "2024-01-15",
      connectedSince: "2024-01-15"
    }
  ];

  const pendingConnections = [
    // Empty for now - would show students awaiting approval
  ];

  return (
    <div>
      <div className="topbar">
        <div>
          <p className="badge">Parent Portal</p>
          <h1 className="page-title">Connect with Students</h1>
        </div>
        <button onClick={() => setShowAddStudentForm(true)} className="button primary">
          Add Student
        </button>
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <h3>👨‍👩‍👧‍👦 Manage Student Connections</h3>
        <p>
          Connect your parent account with your student(s) to view their progress, receive reports,
          and stay engaged with their passion journey. Students must approve connection requests for
          privacy and security.
        </p>
      </div>

      {/* Connected Students */}
      <div style={{ marginBottom: 40 }}>
        <h3 style={{ marginBottom: 16 }}>Connected Students</h3>
        {connectedStudents.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {connectedStudents.map((connection) => (
              <div key={connection.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <h3 style={{ margin: 0 }}>{connection.studentName}</h3>
                      {connection.isPrimary && (
                        <span className="pill" style={{
                          backgroundColor: "var(--primary-color)",
                          color: "white",
                          border: "none",
                          fontSize: 11
                        }}>
                          Primary Contact
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
                      {connection.relationship} • {connection.grade} Grade • {connection.chapterName} Chapter
                    </div>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 12 }}>
                      {connection.studentEmail}
                    </div>

                    <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                        <input type="checkbox" checked={connection.canViewProgress} readOnly />
                        <span>View Progress</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                        <input type="checkbox" checked={connection.canReceiveReports} readOnly />
                        <span>Receive Reports</span>
                      </label>
                    </div>

                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 12 }}>
                      Connected since {new Date(connection.connectedSince).toLocaleDateString()}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="button secondary" style={{ fontSize: 13 }}>
                      Edit Permissions
                    </button>
                    <a href="/parent/dashboard" className="button secondary" style={{ fontSize: 13 }}>
                      View Dashboard →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>👨‍👩‍👧‍👦</div>
            <h3 style={{ marginBottom: 12 }}>No Students Connected</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Add your first student to start viewing their progress and reports
            </p>
            <button onClick={() => setShowAddStudentForm(true)} className="button primary">
              Connect a Student
            </button>
          </div>
        )}
      </div>

      {/* Pending Connections */}
      {pendingConnections.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <h3 style={{ marginBottom: 16 }}>Pending Approval</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pendingConnections.map((pending: any) => (
              <div key={pending.id} className="card" style={{
                backgroundColor: "rgba(245, 158, 11, 0.05)",
                border: "1px solid #f59e0b"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4 style={{ marginBottom: 4 }}>{pending.studentName}</h4>
                    <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                      Waiting for student approval • Requested {new Date(pending.requestedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button className="button secondary" style={{ fontSize: 13 }}>
                    Cancel Request
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Student Form Modal */}
      {showAddStudentForm && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: 600, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <h3>Connect with a Student</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
              Enter your student's information to send a connection request. They will need to approve
              the connection before you can view their progress.
            </p>
            <form action="/api/parent/connect" method="POST">
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Student's Email Address *
                </label>
                <input
                  type="email"
                  name="studentEmail"
                  required
                  placeholder="student@example.com"
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                />
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  This must match the email on their YPP account
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                  Your Relationship to Student *
                </label>
                <select
                  name="relationship"
                  required
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: 6 }}
                >
                  <option value="">Select relationship</option>
                  <option value="Mother">Mother</option>
                  <option value="Father">Father</option>
                  <option value="Guardian">Legal Guardian</option>
                  <option value="Stepparent">Stepparent</option>
                  <option value="Grandparent">Grandparent</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "start", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" name="isPrimary" />
                  <div>
                    <div style={{ fontWeight: 600 }}>Set as Primary Contact</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      Primary contacts receive all official communications and emergency notifications
                    </div>
                  </div>
                </label>
              </div>

              <div style={{
                backgroundColor: "rgba(99, 102, 241, 0.1)",
                padding: 16,
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 14
              }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>What happens next?</div>
                <ol style={{ paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                  <li>Your student will receive a connection request notification</li>
                  <li>They can review and approve/deny the request</li>
                  <li>Once approved, you'll have access to their dashboard and reports</li>
                  <li>Students can revoke access at any time</li>
                </ol>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="submit" className="button primary">
                  Send Connection Request
                </button>
                <button type="button" onClick={() => setShowAddStudentForm(false)} className="button secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="card" style={{ marginTop: 40 }}>
        <h3 style={{ marginBottom: 16 }}>❓ Frequently Asked Questions</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h4 style={{ fontSize: 15, marginBottom: 6 }}>Why does my student need to approve the connection?</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              We respect student privacy and autonomy. Connection approval ensures students are aware of who can view their progress and activities.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 15, marginBottom: 6 }}>Can I connect with multiple students?</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Yes! You can connect with as many students as needed. Each connection can have different permission settings.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 15, marginBottom: 6 }}>What if my student doesn't have an account yet?</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Students must create their own YPP account first. Once they have an account and email verified, you can send a connection request.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 15, marginBottom: 6 }}>Can students remove parent connections?</h4>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Yes, students age 13+ can manage their own parent connections. For students under 13, primary guardians cannot be removed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
