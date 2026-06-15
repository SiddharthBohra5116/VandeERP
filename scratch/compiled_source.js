    ;  layout='main' ; title=student.name; subtitle=`Student · ${student.rollNumber || 'No Roll Number' }`; page='users' ;
  /* Warnings calculations */ const today=new Date(); const isFeeOverdue=fee && Math.max(0, fee.totalAmount - (fee.discount || 0) - fee.paidAmount) > 0 && fee.dueDate && new Date(fee.dueDate) < today; let attendancePct=0; if
    (attendance && attendance.length> 0) {
    const presentCount = attendance.filter(a => a.status === 'present').length;
    attendancePct = Math.round((presentCount / attendance.length) * 100);
    }
    const isAttendanceLow = attendance && attendance.length > 0 && attendancePct < 75; /* Profile completeness
      calculations */ let score=0; let maxScore=6; const missing=[]; if (student.profilePic) score++; else missing.push({
      label: 'Photo' , link: `/admin/users/${student._id}/edit` }); if (student.phone) score++; else missing.push({
      label: 'Phone' , link: `/admin/users/${student._id}/edit` }); if (student.batch) score++; else missing.push({
      label: 'Batch' , link: `/admin/users/${student._id}/edit` }); if (fee) score++; else missing.push({
      label: 'Fee Record' , link: `/admin/fees` }); if (student.idProof) score++; else missing.push({ label: 'ID Proof'
      , link: '#' }); if (student.fatherName || student.motherName) score++; else missing.push({ label: 'Parents' ,
      link: `/admin/users/${student._id}/edit` }); const completenessPct=Math.round((score / maxScore) * 100); 
    ; __line = 14
    ; __append("\n\n      <!-- Breadcrumbs -->\n      <div class=\"breadcrumb\" style=\"font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem;\">\n        <a href=\"/admin/dashboard\" style=\"color: var(--text-sub); transition: color 0.2s;\">Admin</a> &rsaquo;\n        <a href=\"/admin/students\" style=\"color: var(--text-sub); transition: color 0.2s;\">Students</a> &rsaquo;\n        <span style=\"color: var(--gold-light); font-weight: 500;\">\n          ")
    ; __line = 21
    ; __append(escapeFn( student.name ))
    ; __append("\n        </span>\n      </div>\n\n      <!-- Inline Contextual Warnings -->\n      ")
    ; __line = 26
    ;  if (isFeeOverdue) { 
    ; __append("\n        <div class=\"alert alert-warn\" style=\"margin-bottom: 1rem; position: static; max-width: none; animation: none;\">\n          <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\"\n            stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n            <path d=\"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z\" />\n            <line x1=\"12\" y1=\"9\" x2=\"12\" y2=\"13\" />\n            <line x1=\"12\" y1=\"17\" x2=\"12.01\" y2=\"17\" />\n          </svg>\n          <span><strong>Fee Overdue Warning:</strong> Outstanding balance of ₹")
    ; __line = 34
    ; __append(escapeFn( Math.max(0, fee.totalAmount -
              (fee.discount || 0) - fee.paidAmount).toLocaleString('en-IN') ))
    ; __line = 35
    ; __append(" due since ")
    ; __append(escapeFn( new
                Date(fee.dueDate).toLocaleDateString() ))
    ; __line = 36
    ; __append(".</span>\n        </div>\n        ")
    ; __line = 38
    ;  } 
    ; __append("\n\n          ")
    ; __line = 40
    ;  if (isAttendanceLow) { 
    ; __append("\n            <div class=\"alert alert-error\"\n              style=\"margin-bottom: 1rem; position: static; max-width: none; animation: none;\">\n              <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\"\n                stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n                <circle cx=\"12\" cy=\"12\" r=\"10\" />\n                <line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"12\" />\n                <line x1=\"12\" y1=\"16\" x2=\"12.01\" y2=\"16\" />\n              </svg>\n              <span><strong>Low Attendance Warning:</strong> Attendance rate is ")
    ; __line = 49
    ; __append(escapeFn( attendancePct ))
    ; __append("%, which is below\n                  the 75% limit.</span>\n            </div>\n            ")
    ; __line = 52
    ;  } 
    ; __append("\n\n              ")
    ; __line = 54
    ;  if (student.status==='drop' ) { 
    ; __append("\n                <div class=\"alert alert-info\"\n                  style=\"margin-bottom: 1rem; position: static; max-width: none; animation: none; background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.1); color: var(--text-sub);\">\n                  <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\"\n                    stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n                    <circle cx=\"12\" cy=\"12\" r=\"10\" />\n                    <line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"12\" />\n                    <line x1=\"12\" y1=\"16\" x2=\"12.01\" y2=\"16\" />\n                  </svg>\n                  <span>This student profile is inactive (Status: Dropped).</span>\n                </div>\n                ")
    ; __line = 65
    ;  } 
    ; __append("\n\n                  <div style=\"display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;\">\n                    <a href=\"/admin/students\" class=\"btn btn-ghost btn-sm\">&larr; Back to Students</a>\n                    <div style=\"display:flex; gap:0.5rem;\">\n                      ")
    ; __line = 70
    ;  if (student.status==='complete' ) { 
    ; __append("\n                        <a href=\"/admin/students/")
    ; __line = 71
    ; __append(escapeFn( student._id ))
    ; __append("/certificate\" target=\"_blank\" class=\"btn btn-sm\"\n                          style=\"background:var(--gold); color:black; font-weight:700; border-color:var(--gold);\">🎓\n                          View Completion Certificate</a>\n                        ")
    ; __line = 74
    ;  } 
    ; __append("\n                          <a href=\"/admin/users/")
    ; __line = 75
    ; __append(escapeFn( student._id ))
    ; __append("/edit\" class=\"btn btn-primary btn-sm\">Edit Student\n                            Profile</a>\n                    </div>\n                  </div>\n\n                  <!-- Pending Profile Changes Request Card -->\n                  ")
    ; __line = 81
    ;  if (student.pendingProfileUpdate && student.pendingProfileUpdate.requestedAt) { 
    ; __append("\n                    <div class=\"card\"\n                      style=\"margin-bottom: 1.5rem; border-color: var(--gold-border); background: linear-gradient(135deg, rgba(255,204,0,0.03) 0%, rgba(255,204,0,0.01) 100%);\">\n                      <div style=\"display: flex; align-items: flex-start; gap: 1rem;\">\n                        <div\n                          style=\"background: var(--gold-dim); border: 1px solid var(--gold-border); border-radius: var(--radius); padding: 0.5rem; display: flex; align-items: center; justify-content: center; color: var(--gold);\">\n                          <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\"\n                            stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">\n                            <path d=\"M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2\" />\n                            <circle cx=\"8.5\" cy=\"7\" r=\"4\" />\n                            <line x1=\"20\" y1=\"8\" x2=\"20\" y2=\"14\" />\n                            <line x1=\"23\" y1=\"11\" x2=\"17\" y2=\"11\" />\n                          </svg>\n                        </div>\n                        <div style=\"flex: 1;\">\n                          <div\n                            style=\"font-size: 0.85rem; font-weight: 700; color: var(--text); margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.05em;\">\n                            Profile Update Request Pending\n                          </div>\n                          <p style=\"font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;\">\n                            Submitted on ")
    ; __line = 101
    ; __append(escapeFn( new Date(student.pendingProfileUpdate.requestedAt).toLocaleString('en-IN',
                              {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) ))
    ; __line = 102
    ; __append("\n                          </p>\n\n                          <div\n                            style=\"display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem; padding: 0.75rem; background: var(--bg-hover); border-radius: var(--radius); border: 1px solid var(--border);\">\n                            ")
    ; __line = 107
    ;  if (student.pendingProfileUpdate.name && student.pendingProfileUpdate.name
                              !==student.name) { 
    ; __line = 108
    ; __append("\n                              <div>\n                                <div\n                                  style=\"font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;\">\n                                  Full Name</div>\n                                <div\n                                  style=\"font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.2rem;\">\n                                  <span style=\"text-decoration: line-through; color: var(--text-muted);\">\n                                    ")
    ; __line = 116
    ; __append(escapeFn( student.name ))
    ; __append("\n                                  </span>\n                                  <span style=\"color: var(--text-muted);\">&rarr;</span>\n                                  <strong style=\"color: var(--text);\">\n                                    ")
    ; __line = 120
    ; __append(escapeFn( student.pendingProfileUpdate.name ))
    ; __append("\n                                  </strong>\n                                </div>\n                              </div>\n                              ")
    ; __line = 124
    ;  } 
    ; __append("\n\n                                ")
    ; __line = 126
    ;  if (student.pendingProfileUpdate.phone && student.pendingProfileUpdate.phone
                                  !==student.phone) { 
    ; __line = 127
    ; __append("\n                                  <div>\n                                    <div\n                                      style=\"font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;\">\n                                      Phone Number</div>\n                                    <div\n                                      style=\"font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.2rem;\">\n                                      <span style=\"text-decoration: line-through; color: var(--text-muted);\">\n                                        ")
    ; __line = 135
    ; __append(escapeFn( student.phone || '—' ))
    ; __append("\n                                      </span>\n                                      <span style=\"color: var(--text-muted);\">&rarr;</span>\n                                      <strong style=\"color: var(--text);\">\n                                        ")
    ; __line = 139
    ; __append(escapeFn( student.pendingProfileUpdate.phone ))
    ; __append("\n                                      </strong>\n                                    </div>\n                                  </div>\n                                  ")
    ; __line = 143
    ;  } 
    ; __append("\n\n                                    ")
    ; __line = 145
    ;  if (student.pendingProfileUpdate.fatherName &&
                                      student.pendingProfileUpdate.fatherName !==student.fatherName) { 
    ; __line = 146
    ; __append("\n                                      <div>\n                                        <div\n                                          style=\"font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;\">\n                                          Father's Name</div>\n                                        <div\n                                          style=\"font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.2rem;\">\n                                          <span style=\"text-decoration: line-through; color: var(--text-muted);\">\n                                            ")
    ; __line = 154
    ; __append(escapeFn( student.fatherName || '—' ))
    ; __append("\n                                          </span>\n                                          <span style=\"color: var(--text-muted);\">&rarr;</span>\n                                          <strong style=\"color: var(--text);\">\n                                            ")
    ; __line = 158
    ; __append(escapeFn( student.pendingProfileUpdate.fatherName ))
    ; __append("\n                                          </strong>\n                                        </div>\n                                      </div>\n                                      ")
    ; __line = 162
    ;  } 
    ; __append("\n\n                                        ")
    ; __line = 164
    ;  if (student.pendingProfileUpdate.motherName &&
                                          student.pendingProfileUpdate.motherName !==student.motherName) { 
    ; __line = 165
    ; __append("\n                                          <div>\n                                            <div\n                                              style=\"font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;\">\n                                              Mother's Name</div>\n                                            <div\n                                              style=\"font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.2rem;\">\n                                              <span style=\"text-decoration: line-through; color: var(--text-muted);\">\n                                                ")
    ; __line = 173
    ; __append(escapeFn( student.motherName || '—' ))
    ; __append("\n                                              </span>\n                                              <span style=\"color: var(--text-muted);\">&rarr;</span>\n                                              <strong style=\"color: var(--text);\">\n                                                ")
    ; __line = 177
    ; __append(escapeFn( student.pendingProfileUpdate.motherName ))
    ; __append("\n                                              </strong>\n                                            </div>\n                                          </div>\n                                          ")
    ; __line = 181
    ;  } 
    ; __append("\n\n                                            ")
    ; __line = 183
    ;  if (student.pendingProfileUpdate.address &&
                                              student.pendingProfileUpdate.address !==student.address) { 
    ; __line = 184
    ; __append("\n                                              <div>\n                                                <div\n                                                  style=\"font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;\">\n                                                  Address</div>\n                                                <div\n                                                  style=\"font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.2rem;\">\n                                                  <span\n                                                    style=\"text-decoration: line-through; color: var(--text-muted);\">\n                                                    ")
    ; __line = 193
    ; __append(escapeFn( student.address || '—' ))
    ; __append("\n                                                  </span>\n                                                  <span style=\"color: var(--text-muted);\">&rarr;</span>\n                                                  <strong style=\"color: var(--text);\">\n                                                    ")
    ; __line = 197
    ; __append(escapeFn( student.pendingProfileUpdate.address ))
    ; __append("\n                                                  </strong>\n                                                </div>\n                                              </div>\n                                              ")
    ; __line = 201
    ;  } 
    ; __append("\n\n                                                ")
    ; __line = 203
    ;  if (student.pendingProfileUpdate.city &&
                                                  student.pendingProfileUpdate.city !==student.city) { 
    ; __line = 204
    ; __append("\n                                                  <div>\n                                                    <div\n                                                      style=\"font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;\">\n                                                      City</div>\n                                                    <div\n                                                      style=\"font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.2rem;\">\n                                                      <span\n                                                        style=\"text-decoration: line-through; color: var(--text-muted);\">\n                                                        ")
    ; __line = 213
    ; __append(escapeFn( student.city || '—' ))
    ; __append("\n                                                      </span>\n                                                      <span style=\"color: var(--text-muted);\">&rarr;</span>\n                                                      <strong style=\"color: var(--text);\">\n                                                        ")
    ; __line = 217
    ; __append(escapeFn( student.pendingProfileUpdate.city ))
    ; __append("\n                                                      </strong>\n                                                    </div>\n                                                  </div>\n                                                  ")
    ; __line = 221
    ;  } 
    ; __append("\n\n                                                    ")
    ; __line = 223
    ;  if (student.pendingProfileUpdate.dob && (!student.dob || new
                                                      Date(student.pendingProfileUpdate.dob).getTime() !==new
                                                      Date(student.dob).getTime())) { 
    ; __line = 225
    ; __append("\n                                                      <div>\n                                                        <div\n                                                          style=\"font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;\">\n                                                          Date of Birth</div>\n                                                        <div\n                                                          style=\"font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.2rem;\">\n                                                          <span\n                                                            style=\"text-decoration: line-through; color: var(--text-muted);\">\n                                                            ")
    ; __line = 234
    ; __append(escapeFn( student.dob ? new Date(student.dob).toLocaleDateString()
                                                              : '—' ))
    ; __line = 235
    ; __append("\n                                                          </span>\n                                                          <span style=\"color: var(--text-muted);\">&rarr;</span>\n                                                          <strong style=\"color: var(--text);\">\n                                                            ")
    ; __line = 239
    ; __append(escapeFn( new
                                                              Date(student.pendingProfileUpdate.dob).toLocaleDateString()
                                                              ))
    ; __line = 241
    ; __append("\n                                                          </strong>\n                                                        </div>\n                                                      </div>\n                                                      ")
    ; __line = 245
    ;  } 
    ; __append("\n\n                                                        ")
    ; __line = 247
    ;  if (student.pendingProfileUpdate.profilePic &&
                                                          student.pendingProfileUpdate.profilePic !==student.profilePic)
                                                          { 
    ; __line = 249
    ; __append("\n                                                          <div>\n                                                            <div\n                                                              style=\"font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600;\">\n                                                              New Photo</div>\n                                                            <div\n                                                              style=\"display: flex; align-items: center; gap: 0.5rem; margin-top: 0.2rem;\">\n                                                              <img src=\"")
    ; __line = 256
    ; __append(escapeFn( student.pendingProfileUpdate.profilePic ))
    ; __append("\"\n                                                                style=\"width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-light);\"\n                                                                alt=\"New Profile Pic\">\n                                                              <span\n                                                                style=\"font-size: 0.75rem; color: var(--text-muted);\">Uploaded</span>\n                                                            </div>\n                                                          </div>\n                                                          ")
    ; __line = 263
    ;  } 
    ; __append("\n                          </div>\n\n                          <div style=\"display: flex; gap: 0.5rem;\">\n                            <form action=\"/admin/students/")
    ; __line = 267
    ; __append(escapeFn( student._id ))
    ; __append("/approve-profile\" method=\"POST\"\n                              style=\"margin: 0;\">\n                              <button type=\"submit\" class=\"btn btn-sm\"\n                                style=\"background: var(--green); border-color: var(--green); color: white; padding: 0.4rem 1rem; font-weight:600;\">\n                                Approve Changes\n                              </button>\n                            </form>\n                            <form action=\"/admin/students/")
    ; __line = 274
    ; __append(escapeFn( student._id ))
    ; __append("/reject-profile\" method=\"POST\"\n                              style=\"margin: 0;\">\n                              <button type=\"submit\" class=\"btn btn-ghost btn-sm\"\n                                style=\"color: var(--red); border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05); padding: 0.4rem 1rem; font-weight:600;\">\n                                Reject Request\n                              </button>\n                            </form>\n                          </div>\n                        </div>\n                      </div>\n                    </div>\n                    ")
    ; __line = 285
    ;  } 
    ; __append("\n\n                      <!-- Profile Completeness Indicator -->\n                      <div class=\"card\" style=\"margin-bottom: 1.5rem; padding: 1.25rem;\">\n                        <div\n                          style=\"display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;\">\n                          <span style=\"font-size: 0.8rem; font-weight: 600; color: var(--text-sub);\">Profile\n                            Completeness</span>\n                          <span style=\"font-size: 0.85rem; font-weight: bold; color: var(--gold);\">\n                            ")
    ; __line = 294
    ; __append(escapeFn( completenessPct ))
    ; __append("%\n                          </span>\n                        </div>\n                        <div\n                          style=\"background: var(--bg-input); height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 8px;\">\n                          <div\n                            ")
    ; __line = 300
    ; __append(escapeFn( `style="background: linear-gradient(90deg, var(--gold) 0%, var(--gold-hover) 100%); width: ${completenessPct}%; height: 100%;"` ))
    ; __append(">\n                          </div>\n                        </div>\n                        ")
    ; __line = 303
    ;  if (missing.length> 0) { 
    ; __append("\n                          <div style=\"font-size: 0.72rem; color: var(--text-muted);\">\n                            Missing fields:\n                            ")
    ; __line = 306
    ;  missing.forEach((item, idx)=> { 
    ; __append("\n                              <a href=\"")
    ; __line = 307
    ; __append(escapeFn( item.link ))
    ; __append("\"\n                                style=\"color: var(--gold-light); text-decoration: underline; margin-right: 6px;\">\n                                ")
    ; __line = 309
    ; __append(escapeFn( item.label ))
    ; __append("\n                              </a>\n                              ")
    ; __line = 311
    ; __append(escapeFn( idx < missing.length - 1 ? ',' : '' ))
    ; __append("\n                                ")
    ; __line = 312
    ;  }) 
    ; __append("\n                          </div>\n                          ")
    ; __line = 314
    ;  } 
    ; __append("\n                      </div>\n\n                      <div class=\"profile-header\">\n                        ")
    ; __line = 318
    ;  let avatarColor='var(--gold-dark)' ; if (student.role==='admin' ) avatarColor='#1e3a8a' ;
                          else if (student.role==='teacher' ) avatarColor='#065f46' ; else if
                          (student.role==='counsellor' ) avatarColor='#92400e' ; else if (student.role==='student' )
                          avatarColor='#5b21b6' ; 
    ; __line = 321
    ; __append("\n                          <div class=\"avatar-lg\"\n                            ")
    ; __line = 323
    ; __append(escapeFn( !student.profilePic ? `style="background-color: ${avatarColor}; color: #fff; font-weight: bold; display: flex; align-items: center; justify-content: center; font-size: 2.2rem;"` : '' ))
    ; __append(">\n                            ")
    ; __line = 324
    ;  if (student.profilePic) { 
    ; __append("\n                              <img src=\"")
    ; __line = 325
    ; __append(escapeFn( student.profilePic ))
    ; __append("\" alt=\"")
    ; __append(escapeFn( student.name ))
    ; __append("\">\n                              ")
    ; __line = 326
    ;  } else { 
    ; __append("\n                                ")
    ; __line = 327
    ; __append(escapeFn( student.initials ))
    ; __append("\n                                  ")
    ; __line = 328
    ;  } 
    ; __append("\n                          </div>\n                          <div style=\"flex:1;\">\n                            <h2 class=\"profile-name\" style=\"font-size:1.5rem; font-weight:800; color:var(--text);\">\n                              ")
    ; __line = 332
    ; __append(escapeFn( student.name ))
    ; __append("\n                            </h2>\n                            <div\n                              style=\"display:flex; flex-wrap:wrap; gap:12px; margin-top:0.35rem; font-size:0.8rem; color:var(--text-sub);\">\n                              <span>Roll: <strong style=\"color:var(--gold);\">\n                                  ")
    ; __line = 337
    ; __append(escapeFn( student.rollNumber || 'Not Generated' ))
    ; __append("\n                                </strong></span>\n                              <span>&middot;</span>\n                              <span>Course: <strong style=\"color:var(--text);\">\n                                  ")
    ; __line = 341
    ; __append(escapeFn( student.course ))
    ; __append("\n                                </strong></span>\n                              <span>&middot;</span>\n                              <span>Batch: <strong style=\"color:var(--text);\">\n                                  ")
    ; __line = 345
    ; __append(escapeFn( student.batch || 'Unassigned' ))
    ; __append("\n                                </strong></span>\n                              <span>&middot;</span>\n                              <span>Status:\n                                ")
    ; __line = 349
    ;  const statusVal=student.status || (student.isActive ? 'active' : 'inactive' ); const
                                  statusBadgeClass={ active: 'badge-green' , inactive: 'badge-grey' , drop: 'badge-red'
                                  , complete: 'badge-gold' }[statusVal]; 
    ; __line = 351
    ; __append("\n                                  <span class=\"badge ")
    ; __line = 352
    ; __append(escapeFn( statusBadgeClass ))
    ; __append("\">\n                                    ")
    ; __line = 353
    ; __append(escapeFn( statusVal ))
    ; __append("\n                                  </span>\n                              </span>\n                            </div>\n                          </div>\n                      </div>\n\n                      <div class=\"two-col\">\n                        <!-- Left Side: Interactive Details Tabs -->\n                        <div>\n                          <!-- Tabs Navigation -->\n                          <div class=\"card\" style=\"padding: 0.5rem; margin-bottom: 1rem;\">\n                            <div style=\"display: flex; gap: 0.5rem; flex-wrap: wrap;\">\n                              <button class=\"btn btn-sm btn-primary tab-btn\" onclick=\"openTab(event, 'ledger')\">Fee\n                                Ledger</button>\n                              <button class=\"btn btn-sm btn-ghost tab-btn\"\n                                onclick=\"openTab(event, 'attendance')\">Attendance</button>\n                              <button class=\"btn btn-sm btn-ghost tab-btn\" onclick=\"openTab(event, 'progress')\">Progress\n                                & Tests</button>\n                              <button class=\"btn btn-sm btn-ghost tab-btn\" onclick=\"openTab(event, 'crm')\">CRM Lead\n                                History</button>\n                              <button class=\"btn btn-sm btn-ghost tab-btn\"\n                                onclick=\"openTab(event, 'remarks_history')\">Remarks & History</button>\n                              <button class=\"btn btn-sm btn-ghost tab-btn\" onclick=\"openTab(event, 'feedback')\">Course\n                                Feedback</button>\n                              <button class=\"btn btn-sm btn-ghost tab-btn\" onclick=\"openTab(event, 'messages')\">Admin\n                                Messenger</button>\n                            </div>\n                          </div>\n\n                          <!-- Tab: Fee Ledger -->\n                          <div id=\"ledger\" class=\"tab-content card\">\n                            <div class=\"card-header\" style=\"margin-bottom:1.25rem;\">\n                              <div class=\"card-title\">Fee Ledger Summary</div>\n                              <a href=\"/admin/fees/")
    ; __line = 387
    ; __append(escapeFn( student._id ))
    ; __append("\" class=\"btn btn-ghost btn-xs\">Open Full\n                                Invoice</a>\n                            </div>\n\n                            ")
    ; __line = 391
    ;  if (!fee) { 
    ; __append("\n                              <div class=\"empty-state\">\n                                <p>No fee ledger configured for this student.</p>\n                              </div>\n                              ")
    ; __line = 395
    ;  } else { 
    ; __append("\n                                ")
    ; __line = 396
    ;  const actualTotal=fee.totalAmount - (fee.discount || 0); const due=Math.max(0,
                                  fee.totalAmount - (fee.discount || 0) - fee.paidAmount); const pct=fee.totalAmount> 0
                                  ? Math.round((fee.paidAmount / actualTotal) * 100) : 0;
                                  
    ; __line = 399
    ; __append("\n                                  <div class=\"fee-summary\" style=\"margin-bottom: 1.5rem;\">\n                                    <div class=\"stat-card\" style=\"padding: 10px 14px;\">\n                                      <div class=\"stat-label\">Total Course Fee</div>\n                                      <div class=\"stat-value\" style=\"font-size:1.3rem;\">₹")
    ; __line = 403
    ; __append(escapeFn(
                                          fee.totalAmount.toLocaleString('en-IN') ))
    ; __line = 404
    ; __append("\n                                      </div>\n                                    </div>\n                                    <div class=\"stat-card\" style=\"padding: 10px 14px;\">\n                                      <div class=\"stat-label\">Discount Applied</div>\n                                      <div class=\"stat-value text-muted\" style=\"font-size:1.3rem;\">₹")
    ; __line = 409
    ; __append(escapeFn( (fee.discount ||
                                          0).toLocaleString('en-IN') ))
    ; __line = 410
    ; __append("\n                                      </div>\n                                    </div>\n                                    <div class=\"stat-card gold\" style=\"padding: 10px 14px;\">\n                                      <div class=\"stat-label\">Net Payable</div>\n                                      <div class=\"stat-value\" style=\"font-size:1.3rem; color:var(--gold);\">₹")
    ; __line = 415
    ; __append(escapeFn(
                                          actualTotal.toLocaleString('en-IN') ))
    ; __line = 416
    ; __append("\n                                      </div>\n                                    </div>\n                                  </div>\n\n                                  <div class=\"fee-summary\"\n                                    style=\"margin-bottom: 1.5rem; grid-template-columns: 1fr 1fr;\">\n                                    <div class=\"stat-card green\" style=\"padding: 10px 14px;\">\n                                      <div class=\"stat-label\">Total Paid</div>\n                                      <div class=\"stat-value\" style=\"font-size:1.3rem; color:var(--green);\">₹")
    ; __line = 425
    ; __append(escapeFn(
                                          fee.paidAmount.toLocaleString('en-IN') ))
    ; __line = 426
    ; __append("\n                                      </div>\n                                    </div>\n                                    <div class=\"stat-card red\" style=\"padding: 10px 14px;\">\n                                      <div class=\"stat-label\">Outstanding Dues</div>\n                                      <div class=\"stat-value\" style=\"font-size:1.3rem; color:var(--red);\">₹")
    ; __line = 431
    ; __append(escapeFn(
                                          due.toLocaleString('en-IN') ))
    ; __line = 432
    ; __append("\n                                      </div>\n                                      <div class=\"stat-sub\" style=\"font-size:9px;\">Includes ₹")
    ; __line = 434
    ; __append(escapeFn( (fee.totalFine ||
                                          0).toLocaleString('en-IN') ))
    ; __line = 435
    ; __append(" late fines</div>\n                                    </div>\n                                  </div>\n\n                                  <!-- Installments Schedule -->\n                                  <div class=\"section-title\" style=\"margin-top: 1.5rem; margin-bottom: 8px;\">\n                                    Installments Breakdown</div>\n                                  <div\n                                    style=\"display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;\">\n                                    ")
    ; __line = 444
    ;  if (fee.installments && fee.installments.length> 0) { 
    ; __append("\n                                      ")
    ; __line = 445
    ;  fee.installments.forEach(inst=> { 
    ; __append("\n                                        ")
    ; __line = 446
    ;  const isPaid=inst.paidAmount>= inst.amount;
                                          const isLate = !isPaid && inst.dueDate && new Date(inst.dueDate) < new Date();
                                            let fine=0; if (isLate) { const diffDays=Math.ceil(Math.abs(new Date() - new
                                            Date(inst.dueDate)) / (1000 * 60 * 60 * 24)); if (diffDays> 60) fine = 1000;
                                            else if (diffDays > 30) fine = 500;
                                            else fine = 250;
                                            }

                                            const statusLabel = isPaid ? 'Paid' : isLate ? 'Overdue' : 'Pending';
                                            const statusBadgeClass = isPaid ? 'badge-green' : isLate ? 'badge-red' :
                                            'badge-orange';
                                            const instPct = inst.amount > 0 ? Math.round((inst.paidAmount / inst.amount)
                                            * 100) : 0;
                                            
    ; __line = 459
    ; __append("\n                                            <div\n                                              ")
    ; __line = 461
    ; __append(escapeFn( isLate ? 'style="background:var(--bg-input); border: 1px solid rgba(239,68,68,0.2); border-radius:var(--radius); padding: 10px 12px; display:flex; flex-direction:column; gap:4px;"' : 'style="background:var(--bg-input); border: 1px solid var(--border); border-radius:var(--radius); padding: 10px 12px; display:flex; flex-direction:column; gap:4px;"' ))
    ; __append(">\n                                              <div\n                                                style=\"display:flex; justify-content:space-between; align-items:center;\">\n                                                <span style=\"font-size:11px; font-weight:700; color:var(--text);\">\n                                                  ")
    ; __line = 465
    ; __append(escapeFn( inst.name ))
    ; __append("\n                                                </span>\n                                                <span class=\"badge ")
    ; __line = 467
    ; __append(escapeFn( statusBadgeClass ))
    ; __append("\"\n                                                  style=\"font-size:8px; padding:1px 4px;\">\n                                                  ")
    ; __line = 469
    ; __append(escapeFn( statusLabel ))
    ; __append("\n                                                </span>\n                                              </div>\n                                              <div\n                                                style=\"font-size:14px; font-weight:800; color:var(--gold); font-family:var(--mono);\">\n                                                ₹")
    ; __line = 474
    ; __append(escapeFn( inst.amount.toLocaleString('en-IN') ))
    ; __append("\n                                              </div>\n                                              <div style=\"font-size:10px; color:var(--text-muted);\">\n                                                Due: <span class=\"mono\">\n                                                  ")
    ; __line = 478
    ; __append(escapeFn( new Date(inst.dueDate).toLocaleDateString('en-IN',
                                                    {day:'numeric',month:'short'}) ))
    ; __line = 479
    ; __append("\n                                                </span>\n                                              </div>\n                                              ")
    ; __line = 482
    ;  if (fine> 0) { 
    ; __append("\n                                                <div\n                                                  style=\"font-size:10px; color:var(--red); font-weight:700; margin-top:2px;\">\n                                                  ⚠️ Fine: +₹")
    ; __line = 485
    ; __append(escapeFn( fine ))
    ; __append("\n                                                </div>\n                                                ")
    ; __line = 487
    ;  } 
    ; __append("\n                                                  <div style=\"margin-top:auto; padding-top:4px;\">\n                                                    <div\n                                                      style=\"display:flex; justify-content:space-between; font-size:9px; color:var(--text-muted); margin-bottom:2px;\">\n                                                      <span>Paid: ₹")
    ; __line = 491
    ; __append(escapeFn( inst.paidAmount.toLocaleString('en-IN') ))
    ; __append("</span>\n                                                      <span>\n                                                        ")
    ; __line = 493
    ; __append(escapeFn( instPct ))
    ; __append("%\n                                                      </span>\n                                                    </div>\n                                                    <div class=\"progress-bar\"\n                                                      style=\"height:3px; background:rgba(255,255,255,0.05); border-radius: 4px;\">\n                                                      <div\n                                                        class=\"progress-fill ")
    ; __line = 499
    ; __append(escapeFn( isPaid ? 'green' : instPct > 0 ? 'orange' : 'red' ))
    ; __append("\"\n                                                        ")
    ; __line = 500
    ; __append(escapeFn( `style="width: ${instPct}%"` ))
    ; __append("></div>\n                                                    </div>\n                                                  </div>\n                                            </div>\n                                            ")
    ; __line = 504
    ;  }) 
    ; __append("\n                                              ")
    ; __line = 505
    ;  } 
    ; __append("\n                                  </div>\n\n                                  <div class=\"section-title\">Payments Log</div>\n                                  ")
    ; __line = 509
    ;  if (!fee.payments || fee.payments.length===0) { 
    ; __append("\n                                    <div class=\"empty-state\" style=\"padding:1.5rem;\">\n                                      <p>No payments recorded yet.</p>\n                                    </div>\n                                    ")
    ; __line = 513
    ;  } else { 
    ; __append("\n                                      <div class=\"table-wrap\">\n                                        <table>\n                                          <thead>\n                                            <tr>\n                                              <th>Date</th>\n                                              <th>Amount</th>\n                                              <th>Method</th>\n                                              <th>TXN ID</th>\n                                              <th>Note</th>\n                                              <th>Received By</th>\n                                            </tr>\n                                          </thead>\n                                          <tbody>\n                                            ")
    ; __line = 527
    ;  fee.payments.forEach(p=> { 
    ; __append("\n                                              <tr>\n                                                <td class=\"mono text-xs\">\n                                                  ")
    ; __line = 530
    ; __append(escapeFn( new Date(p.date).toLocaleDateString('en-IN',
                                                    {day:'numeric',month:'short'}) ))
    ; __line = 531
    ; __append("\n                                                </td>\n                                                <td class=\"mono text-green\" style=\"font-weight:600;\">₹")
    ; __line = 533
    ; __append(escapeFn( p.amount ))
    ; __append("\n                                                </td>\n                                                <td><span class=\"badge badge-grey\">\n                                                    ")
    ; __line = 536
    ; __append(escapeFn( p.method ))
    ; __append("\n                                                  </span></td>\n                                                <td class=\"mono text-xs\">\n                                                  ")
    ; __line = 539
    ; __append(escapeFn( p.transactionId || '—' ))
    ; __append("\n                                                </td>\n                                                <td style=\"max-width:120px; font-size:12px;\">\n                                                  ")
    ; __line = 542
    ; __append(escapeFn( p.note || '—' ))
    ; __append("\n                                                </td>\n                                                <td style=\"font-size:12px;\">\n                                                  ")
    ; __line = 545
    ; __append(escapeFn( p.receivedBy ? p.receivedBy.name : 'System' ))
    ; __append("\n                                                </td>\n                                              </tr>\n                                              ")
    ; __line = 548
    ;  }) 
    ; __append("\n                                          </tbody>\n                                        </table>\n                                      </div>\n                                      ")
    ; __line = 552
    ;  } 
    ; __append("\n                                        ")
    ; __line = 553
    ;  } 
    ; __append("\n                          </div>\n\n                          <!-- Tab: Attendance -->\n                          <div id=\"attendance\" class=\"tab-content card\" style=\"display:none;\">\n                            <div class=\"card-header\" style=\"margin-bottom:1.25rem;\">\n                              <div class=\"card-title\">Attendance Overview</div>\n                              ")
    ; __line = 560
    ;  const totalClasses=attendance.length; const presentCount=attendance.filter(a=> a.status
                                === 'present').length;
                                const lateCount = attendance.filter(a => a.status === 'late').length;
                                const absentCount = attendance.filter(a => a.status === 'absent').length;
                                const pct = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;
                                
    ; __line = 565
    ; __append("\n                                <span class=\"badge badge-gold\">\n                                  ")
    ; __line = 567
    ; __append(escapeFn( pct ))
    ; __append("% Presence Rate\n                                </span>\n                            </div>\n\n                            <div class=\"stats-grid\"\n                              style=\"grid-template-columns: repeat(4, 1fr); margin-bottom:1.5rem;\">\n                              <div class=\"stat-card\" style=\"padding:8px 12px;\">\n                                <div class=\"stat-label\" style=\"font-size:10px;\">Total Lectures</div>\n                                <div class=\"stat-value\" style=\"font-size:1.15rem;\">\n                                  ")
    ; __line = 576
    ; __append(escapeFn( totalClasses ))
    ; __append("\n                                </div>\n                              </div>\n                              <div class=\"stat-card green\" style=\"padding:8px 12px;\">\n                                <div class=\"stat-label\" style=\"font-size:10px;\">Present</div>\n                                <div class=\"stat-value\" style=\"font-size:1.15rem; color:var(--green);\">\n                                  ")
    ; __line = 582
    ; __append(escapeFn( presentCount ))
    ; __append("\n                                </div>\n                              </div>\n                              <div class=\"stat-card orange\" style=\"padding:8px 12px;\">\n                                <div class=\"stat-label\" style=\"font-size:10px;\">Late</div>\n                                <div class=\"stat-value\" style=\"font-size:1.15rem; color:var(--orange);\">\n                                  ")
    ; __line = 588
    ; __append(escapeFn( lateCount ))
    ; __append("\n                                </div>\n                              </div>\n                              <div class=\"stat-card red\" style=\"padding:8px 12px;\">\n                                <div class=\"stat-label\" style=\"font-size:10px;\">Absent</div>\n                                <div class=\"stat-value\" style=\"font-size:1.15rem; color:var(--red);\">\n                                  ")
    ; __line = 594
    ; __append(escapeFn( absentCount ))
    ; __append("\n                                </div>\n                              </div>\n                            </div>\n\n                            <div class=\"section-title\">Attendance History Logs</div>\n                            ")
    ; __line = 600
    ;  if (attendance.length===0) { 
    ; __append("\n                              <div class=\"empty-state\">\n                                <p>No attendance records logged for this student yet.</p>\n                              </div>\n                              ")
    ; __line = 604
    ;  } else { 
    ; __append("\n                                <div class=\"table-wrap\">\n                                  <table>\n                                    <thead>\n                                      <tr>\n                                        <th>Date</th>\n                                        <th>Subject</th>\n                                        <th>Status</th>\n                                        <th>Instructor</th>\n                                        <th>Notes</th>\n                                      </tr>\n                                    </thead>\n                                    <tbody>\n                                      ")
    ; __line = 617
    ;  attendance.forEach(a=> { 
    ; __append("\n                                        <tr>\n                                          <td class=\"mono text-sm fw-600\">\n                                            ")
    ; __line = 620
    ; __append(escapeFn( a.date ))
    ; __append("\n                                          </td>\n                                          <td>\n                                            ")
    ; __line = 623
    ; __append(escapeFn( a.course && a.course.name ? a.course.name : '—' ))
    ; __append("\n                                          </td>\n                                          <td>\n                                            ")
    ; __line = 626
    ;  const statusClass={ present: 'badge-green' , absent: 'badge-red' ,
                                              late: 'badge-orange' }[a.status] || 'badge-grey' ; 
    ; __line = 627
    ; __append("\n                                              <span class=\"badge ")
    ; __line = 628
    ; __append(escapeFn( statusClass ))
    ; __append("\">\n                                                ")
    ; __line = 629
    ; __append(escapeFn( a.status ))
    ; __append("\n                                              </span>\n                                          </td>\n                                          <td>\n                                            ")
    ; __line = 633
    ; __append(escapeFn( a.teacher ? a.teacher.name : 'Faculty' ))
    ; __append("\n                                          </td>\n                                          <td style=\"font-size:12px; color:var(--text-sub);\">\n                                            ")
    ; __line = 636
    ; __append(escapeFn( a.note || '—' ))
    ; __append("\n                                          </td>\n                                        </tr>\n                                        ")
    ; __line = 639
    ;  }) 
    ; __append("\n                                    </tbody>\n                                  </table>\n                                </div>\n                                ")
    ; __line = 643
    ;  } 
    ; __append("\n                          </div>\n\n                          <!-- Tab: Progress -->\n                          <div id=\"progress\" class=\"tab-content card\" style=\"display:none;\">\n                            <div class=\"card-header\" style=\"margin-bottom:1.25rem;\">\n                              <div class=\"card-title\">Academic Progress & Test Scores</div>\n                            </div>\n\n                            ")
    ; __line = 652
    ;  if (!progress || !progress.testResults || progress.testResults.length===0) { 
    ; __append("\n                              <div class=\"empty-state\">\n                                <p>No test scores or progress records registered for this student.</p>\n                              </div>\n                              ")
    ; __line = 656
    ;  } else { 
    ; __append("\n                                <div\n                                  style=\"background:var(--bg3); padding:1rem; border-radius:var(--radius); margin-bottom:1.5rem;\">\n                                  <div\n                                    style=\"font-size:0.75rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.4rem;\">\n                                    Tutor Remarks</div>\n                                  <p style=\"font-size:0.85rem; color:var(--text-sub); line-height:1.5;\">\n                                    ")
    ; __line = 663
    ; __append(escapeFn( progress.teacherRemark || 'No remarks recorded.' ))
    ; __append("\n                                  </p>\n                                  <div\n                                    style=\"font-size:0.7rem; color:var(--text-muted); margin-top:0.5rem; text-align:right;\">\n                                    Last Updated by: ")
    ; __line = 667
    ; __append(escapeFn( progress.teacher ? progress.teacher.name : 'Faculty' ))
    ; __append("\n                                  </div>\n                                </div>\n\n                                <div class=\"section-title\">Test Performance</div>\n                                <div class=\"table-wrap\">\n                                  <table>\n                                    <thead>\n                                      <tr>\n                                        <th>Date</th>\n                                        <th>Test Name</th>\n                                        <th>Score</th>\n                                        <th>Percentage</th>\n                                        <th>Remarks</th>\n                                      </tr>\n                                    </thead>\n                                    <tbody>\n                                      ")
    ; __line = 684
    ;  progress.testResults.forEach(test=> { 
    ; __append("\n                                        ")
    ; __line = 685
    ;  const pct=test.totalMarks> 0 ? Math.round((test.score / test.totalMarks) *
                                          100) : 0; 
    ; __line = 686
    ; __append("\n                                          <tr>\n                                            <td class=\"mono text-xs\">\n                                              ")
    ; __line = 689
    ; __append(escapeFn( test.date ))
    ; __append("\n                                            </td>\n                                            <td><strong>\n                                                ")
    ; __line = 692
    ; __append(escapeFn( test.testName ))
    ; __append("\n                                              </strong></td>\n                                            <td class=\"mono\">\n                                              ")
    ; __line = 695
    ; __append(escapeFn( test.score ))
    ; __append(" / ")
    ; __append(escapeFn( test.totalMarks ))
    ; __append("\n                                            </td>\n                                            <td>\n                                              <span\n                                                class=\"badge ")
    ; __line = 699
    ; __append(escapeFn( pct >= 75 ? 'badge-green' : pct >= 50 ? 'badge-blue' : 'badge-red' ))
    ; __append("\">\n                                                ")
    ; __line = 700
    ; __append(escapeFn( pct ))
    ; __append("%\n                                              </span>\n                                            </td>\n                                            <td style=\"font-size:12px; max-width:180px;\">\n                                              ")
    ; __line = 704
    ; __append(escapeFn( test.remarks || '—' ))
    ; __append("\n                                            </td>\n                                          </tr>\n                                          ")
    ; __line = 707
    ;  }) 
    ; __append("\n                                    </tbody>\n                                  </table>\n                                </div>\n                                ")
    ; __line = 711
    ;  } 
    ; __append("\n                          </div>\n\n                          <!-- Tab: CRM Lead History -->\n                          <div id=\"crm\" class=\"tab-content card\" style=\"display:none;\">\n                            <div class=\"card-header\" style=\"margin-bottom:1.25rem;\">\n                              <div class=\"card-title\">Admission & CRM Logs</div>\n                            </div>\n\n                            ")
    ; __line = 720
    ;  if (!lead) { 
    ; __append("\n                              <div class=\"empty-state\">\n                                <p>No original Lead CRM profile found matching this student account.</p>\n                              </div>\n                              ")
    ; __line = 724
    ;  } else { 
    ; __append("\n                                <div\n                                  style=\"display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:1.5rem; background:var(--bg3); padding:1rem; border-radius:var(--radius);\">\n                                  <div>\n                                    <div style=\"font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;\">\n                                      original lead source</div>\n                                    <div\n                                      style=\"font-size:0.9rem; font-weight:600; color:var(--gold); margin-top:0.15rem;\">\n                                      ")
    ; __line = 732
    ; __append(escapeFn( lead.source ))
    ; __append("\n                                    </div>\n                                  </div>\n                                  <div>\n                                    <div style=\"font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;\">\n                                      converted student logic</div>\n                                    <div\n                                      style=\"font-size:0.9rem; font-weight:600; color:var(--text); margin-top:0.15rem;\">\n                                      Counsellor: ")
    ; __line = 740
    ; __append(escapeFn( lead.assignedTo ? lead.assignedTo.name : 'Unassigned' ))
    ; __append("\n                                    </div>\n                                  </div>\n                                </div>\n\n                                <div class=\"section-title\">Timeline of Lead Interactions</div>\n                                ")
    ; __line = 746
    ;  if (!lead.followUpHistory || lead.followUpHistory.length===0) { 
    ; __append("\n                                  <div class=\"empty-state\" style=\"padding:1.5rem;\">\n                                    <p>No followup timeline logged for this prospect lead.</p>\n                                  </div>\n                                  ")
    ; __line = 750
    ;  } else { 
    ; __append("\n                                    <div class=\"timeline\" style=\"margin-left: 10px;\">\n                                      ")
    ; __line = 752
    ;  lead.followUpHistory.slice().reverse().forEach(fu=> { 
    ; __append("\n                                        <div class=\"tl-item\">\n                                          <div style=\"font-weight:600; font-size:13px; color:var(--text);\">Status\n                                            change: <span class=\"badge badge-grey\" style=\"font-size:10px;\">\n                                              ")
    ; __line = 756
    ; __append(escapeFn( fu.status ))
    ; __append("\n                                            </span></div>\n                                          <div class=\"tl-meta\">\n                                            ")
    ; __line = 759
    ; __append(escapeFn( new Date(fu.doneAt).toLocaleDateString('en-IN',
                                              {day:'numeric',month:'short',year:'numeric'}) ))
    ; __line = 760
    ; __append("\n                                              at ")
    ; __line = 761
    ; __append(escapeFn( new Date(fu.doneAt).toLocaleTimeString('en-IN',
                                                {hour:'2-digit',minute:'2-digit'}) ))
    ; __line = 762
    ; __append("\n                                          </div>\n                                          <div class=\"tl-body\" style=\"font-size:12px; margin-top:0.25rem;\">\n                                            ")
    ; __line = 765
    ; __append(escapeFn( fu.note ))
    ; __append("\n                                          </div>\n                                        </div>\n                                        ")
    ; __line = 768
    ;  }) 
    ; __append("\n                                    </div>\n                                    ")
    ; __line = 770
    ;  } 
    ; __append("\n                                      ")
    ; __line = 771
    ;  } 
    ; __append("\n                          </div>\n\n                          <!-- Tab: Remarks & History -->\n                          <div id=\"remarks_history\" class=\"tab-content card\" style=\"display:none;\">\n                            <div style=\"display:grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;\">\n\n                              <!-- Remarks Section -->\n                              <div>\n                                <div class=\"card-header\"\n                                  style=\"margin-bottom:1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);\">\n                                  <div class=\"card-title\">Staff Remarks & Timeline</div>\n                                </div>\n\n                                <!-- Add Remark Form -->\n                                <form action=\"/admin/students/")
    ; __line = 786
    ; __append(escapeFn( student._id ))
    ; __append("/remark\" method=\"POST\"\n                                  style=\"background:var(--bg3); padding:0.85rem; border-radius:var(--radius); margin-bottom:1rem;\">\n                                  <div class=\"form-group\">\n                                    <label class=\"form-label\" style=\"font-size: 10px;\">Post Profile Remark Note</label>\n                                    <textarea name=\"note\" class=\"form-control\"\n                                      placeholder=\"Write a note about student progress, behavior or payments...\"\n                                      required style=\"min-height:60px; font-size:12px;\"></textarea>\n                                  </div>\n                                  <button type=\"submit\" class=\"btn btn-primary btn-xs\" style=\"margin-top:0.5rem;\">Post\n                                    Remark</button>\n                                </form>\n\n                                <!-- Remarks Timeline -->\n                                ")
    ; __line = 799
    ;  if (!student.remarks || student.remarks.length===0) { 
    ; __append("\n                                  <div class=\"empty-state\" style=\"padding:1rem;\">\n                                    <p style=\"font-size:12px;\">No remarks posted on this student profile.</p>\n                                  </div>\n                                  ")
    ; __line = 803
    ;  } else { 
    ; __append("\n                                    <div class=\"timeline\" style=\"padding-left:0.5rem;\">\n                                      ")
    ; __line = 805
    ;  student.remarks.slice().reverse().forEach(rem=> { 
    ; __append("\n                                        <div class=\"timeline-item\">\n                                          <div class=\"timeline-dot active\"></div>\n                                          <div class=\"timeline-body\" style=\"padding: 0.35rem 0.5rem;\">\n                                            <div style=\"font-size:12px; font-weight:600; color:var(--text);\">\n                                              ")
    ; __line = 810
    ; __append(escapeFn( rem.note ))
    ; __append("\n                                            </div>\n                                            <div style=\"font-size:10px; color:var(--text-muted); margin-top:0.2rem;\">\n                                              By: <span style=\"color:var(--gold);\">\n                                                ")
    ; __line = 814
    ; __append(escapeFn( rem.role ? rem.role.toUpperCase() : 'STAFF' ))
    ; __append("\n                                              </span> ·\n                                              ")
    ; __line = 816
    ; __append(escapeFn( new Date(rem.date).toLocaleDateString('en-IN',
                                                {day:'numeric',month:'short'}) ))
    ; __line = 817
    ; __append("\n                                            </div>\n                                          </div>\n                                        </div>\n                                        ")
    ; __line = 821
    ;  }) 
    ; __append("\n                                    </div>\n                                    ")
    ; __line = 823
    ;  } 
    ; __append("\n                              </div>\n\n                              <!-- Enrollment Status History Section -->\n                              <div>\n                                <div class=\"card-header\"\n                                  style=\"margin-bottom:1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border);\">\n                                  <div class=\"card-title\">Status Control & Logs</div>\n                                </div>\n\n                                <!-- Change Status Form -->\n                                <form action=\"/admin/students/")
    ; __line = 834
    ; __append(escapeFn( student._id ))
    ; __append("/status\" method=\"POST\"\n                                  style=\"background:var(--bg3); padding:0.85rem; border-radius:var(--radius); margin-bottom:1rem;\">\n                                  <div class=\"form-row\">\n                                    <div class=\"form-group\">\n                                      <label class=\"form-label\" style=\"font-size: 10px;\">Set Status</label>\n                                      <select name=\"status\" class=\"form-control\"\n                                        style=\"font-size:12px; height:32px; padding: 2px 8px;\" required>\n                                        <option value=\"active\" ")
    ; __line = 841
    ; __append(escapeFn(student.status==='active' ? 'selected' : '' ))
    ; __append(">Active\n                                        </option>\n                                        <option value=\"inactive\" ")
    ; __line = 843
    ; __append(escapeFn(student.status==='inactive' ? 'selected' : '' ))
    ; __append("\n                                          >Inactive</option>\n                                        <option value=\"drop\" ")
    ; __line = 845
    ; __append(escapeFn(student.status==='drop' ? 'selected' : '' ))
    ; __append(">Drop\n                                        </option>\n                                        <option value=\"complete\" ")
    ; __line = 847
    ; __append(escapeFn(student.status==='complete' ? 'selected' : '' ))
    ; __append("\n                                          >Complete</option>\n                                      </select>\n                                    </div>\n                                  </div>\n                                  <div class=\"form-group\" style=\"margin-top:0.5rem;\">\n                                    <label class=\"form-label\" style=\"font-size: 10px;\">Reason for Change</label>\n                                    <input type=\"text\" name=\"reason\" class=\"form-control\"\n                                      placeholder=\"e.g. Cleared all dues, left mid-term...\" required\n                                      style=\"height:32px; font-size:12px;\">\n                                  </div>\n                                  <button type=\"submit\" class=\"btn btn-primary btn-xs\" style=\"margin-top:0.5rem;\">Update\n                                    Status</button>\n                                </form>\n\n                                <!-- Status History Log -->\n                                ")
    ; __line = 863
    ;  if (!student.statusHistory || student.statusHistory.length===0) { 
    ; __append("\n                                  <div class=\"empty-state\" style=\"padding:1rem;\">\n                                    <p style=\"font-size:12px;\">No status changes recorded.</p>\n                                  </div>\n                                  ")
    ; __line = 867
    ;  } else { 
    ; __append("\n                                    <div class=\"table-wrap\">\n                                      <table style=\"font-size:11px;\">\n                                        <thead>\n                                          <tr>\n                                            <th>Status</th>\n                                            <th>Reason</th>\n                                            <th>Date</th>\n                                          </tr>\n                                        </thead>\n                                        <tbody>\n                                          ")
    ; __line = 878
    ;  student.statusHistory.slice().reverse().forEach(hist=> { 
    ; __append("\n                                            <tr>\n                                              <td>\n                                                <span\n                                                  class=\"badge badge-xs ")
    ; __line = 882
    ; __append(escapeFn( hist.status === 'active' ? 'badge-green' : hist.status === 'inactive' ? 'badge-grey' : hist.status === 'drop' ? 'badge-red' : 'badge-gold' ))
    ; __append("\">\n                                                  ")
    ; __line = 883
    ; __append(escapeFn( hist.status ))
    ; __append("\n                                                </span>\n                                              </td>\n                                              <td>\n                                                ")
    ; __line = 887
    ; __append(escapeFn( hist.reason ))
    ; __append("\n                                              </td>\n                                              <td class=\"mono\">\n                                                ")
    ; __line = 890
    ; __append(escapeFn( new Date(hist.date).toLocaleDateString('en-IN',
                                                  {day:'numeric',month:'short'}) ))
    ; __line = 891
    ; __append("\n                                              </td>\n                                            </tr>\n                                            ")
    ; __line = 894
    ;  }) 
    ; __append("\n                                        </tbody>\n                                      </table>\n                                    </div>\n                                    ")
    ; __line = 898
    ;  } 
    ; __append("\n                              </div>\n\n                            </div>\n                          </div>\n\n                          <!-- Tab: Course Feedback -->\n                          <div id=\"feedback\" class=\"tab-content card\" style=\"display:none;\">\n                            <div class=\"card-header\" style=\"margin-bottom:1.25rem;\">\n                              <div class=\"card-title\">Course Completion Feedback</div>\n                            </div>\n\n                            ")
    ; __line = 910
    ;  if (!student.feedback || !student.feedback.submitted) { 
    ; __append("\n                              <div class=\"empty-state\">\n                                <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"32\" height=\"32\" viewBox=\"0 0 24 24\"\n                                  fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"\n                                  stroke-linejoin=\"round\" style=\"opacity:0.2; margin-bottom:0.5rem;\">\n                                  <path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\" />\n                                </svg>\n                                <p>This student has not submitted course feedback yet (feedback is requested upon status\n                                  marking as \"complete\").</p>\n                              </div>\n                              ")
    ; __line = 920
    ;  } else { 
    ; __append("\n                                <div\n                                  style=\"background:var(--bg3); padding:1.25rem; border-radius:var(--radius); border:1px solid var(--border);\">\n                                  <div class=\"fee-summary\"\n                                    style=\"margin-bottom: 1.5rem; grid-template-columns: repeat(3, 1fr);\">\n                                    <div class=\"stat-card\" style=\"padding: 10px 14px; text-align: center;\">\n                                      <div class=\"stat-label\">Instructor Rating</div>\n                                      <div class=\"stat-value\" style=\"font-size:1.8rem; color:var(--gold);\">\n                                        ")
    ; __line = 928
    ; __append(escapeFn( student.feedback.teacherRating ))
    ; __append(" / 5\n                                      </div>\n                                    </div>\n                                    <div class=\"stat-card\" style=\"padding: 10px 14px; text-align: center;\">\n                                      <div class=\"stat-label\">Content Rating</div>\n                                      <div class=\"stat-value\" style=\"font-size:1.8rem; color:var(--gold);\">\n                                        ")
    ; __line = 934
    ; __append(escapeFn( student.feedback.contentRating ))
    ; __append(" / 5\n                                      </div>\n                                    </div>\n                                    <div class=\"stat-card\" style=\"padding: 10px 14px; text-align: center;\">\n                                      <div class=\"stat-label\">Facilities Rating</div>\n                                      <div class=\"stat-value\" style=\"font-size:1.8rem; color:var(--gold);\">\n                                        ")
    ; __line = 940
    ; __append(escapeFn( student.feedback.facilitiesRating ))
    ; __append(" / 5\n                                      </div>\n                                    </div>\n                                  </div>\n\n                                  <div class=\"form-group\">\n                                    <label class=\"form-label\"\n                                      style=\"font-size:11px; text-transform:uppercase; color:var(--text-muted);\">Written\n                                      Comments / Suggestions</label>\n                                    <blockquote\n                                      style=\"font-style:italic; font-size:0.9rem; color:var(--text); background:var(--bg-input); padding:0.85rem; border-left:3px solid var(--gold); border-radius:4px; margin-top:0.35rem; line-height:1.5;\">\n                                      \"")
    ; __line = 951
    ; __append(escapeFn( student.feedback.comments || 'No written comments provided.' ))
    ; __append("\"\n                                    </blockquote>\n                                  </div>\n\n                                  <div\n                                    style=\"font-size:10px; color:var(--text-muted); margin-top:1rem; text-align:right;\">\n                                    Submitted on: ")
    ; __line = 957
    ; __append(escapeFn( new Date(student.feedback.submittedAt).toLocaleDateString('en-IN',
                                      {day:'numeric',month:'short',year:'numeric'}) ))
    ; __line = 958
    ; __append("\n                                  </div>\n                                </div>\n                                ")
    ; __line = 961
    ;  } 
    ; __append("\n                          </div>\n\n                          <!-- Tab: Admin Messenger -->\n                          <div id=\"messages\" class=\"tab-content card\" style=\"display:none;\">\n                            <div class=\"card-header\" style=\"margin-bottom:1.25rem;\">\n                              <div class=\"card-title\">Student Inbox Notes</div>\n                            </div>\n                            <form action=\"/admin/messages/send\" method=\"POST\"\n                              style=\"background:var(--bg3); padding:1rem; border-radius:var(--radius); margin-bottom:1.5rem;\">\n                              <input type=\"hidden\" name=\"recipientId\" value=\"")
    ; __line = 971
    ; __append(escapeFn( student.userId._id ))
    ; __append("\">\n                              <input type=\"hidden\" name=\"redirect\" value=\"/admin/students/")
    ; __line = 972
    ; __append(escapeFn( student._id ))
    ; __append("\">\n                              <div class=\"form-group\">\n                                <label class=\"form-label\" for=\"msg_content\">Send Notification / Message Note</label>\n                                <textarea id=\"msg_content\" name=\"content\" class=\"form-control\"\n                                  placeholder=\"Type notification details or message to show on student dashboard...\"\n                                  required></textarea>\n                              </div>\n                              <button type=\"submit\" class=\"btn btn-primary btn-sm\">Send Note to Student</button>\n                            </form>\n                            <div class=\"section-title\">Sent Logs</div>\n                            ")
    ; __line = 982
    ;  if (messages.length===0) { 
    ; __append("\n                              <div class=\"empty-state\" style=\"padding:1.5rem;\">\n                                <p>No messages sent to this student yet.</p>\n                              </div>\n                              ")
    ; __line = 986
    ;  } else { 
    ; __append("\n                                <div style=\"display:flex; flex-direction:column; gap:10px;\">\n                                  ")
    ; __line = 988
    ;  messages.forEach(msg=> { 
    ; __append("\n                                    <div\n                                      style=\"background:var(--bg2); border:1px solid var(--border); padding:10px 12px; border-radius:var(--radius-sm);\">\n                                      <p style=\"font-size:13px; color:var(--text); line-height:1.5;\">\n                                        ")
    ; __line = 992
    ; __append(escapeFn( msg.content ))
    ; __append("\n                                      </p>\n                                      <div\n                                        style=\"display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted); margin-top:5px;\">\n                                        <span>By: ")
    ; __line = 996
    ; __append(escapeFn( msg.sender ? msg.sender.name : 'Admin' ))
    ; __append(" (")
    ; __append(escapeFn( msg.sender ?
                                              msg.sender.role : 'System' ))
    ; __line = 997
    ; __append(")</span>\n                                        <span>\n                                          ")
    ; __line = 999
    ; __append(escapeFn( new Date(msg.createdAt).toLocaleDateString('en-IN',
                                            {day:'numeric',month:'short'}) ))
    ; __line = 1000
    ; __append(" &nbsp;·&nbsp; ")
    ; __append(escapeFn( new
                                              Date(msg.createdAt).toLocaleTimeString('en-IN',
                                              {hour:'2-digit',minute:'2-digit'}) ))
    ; __line = 1002
    ; __append("\n                                        </span>\n                                      </div>\n                                    </div>\n                                    ")
    ; __line = 1006
    ;  }) 
    ; __append("\n                                </div>\n                                ")
    ; __line = 1008
    ;  } 
    ; __append("\n                          </div>\n                        </div>\n\n                        <!-- Right Side: Quick Contacts & Connections -->\n                        <div>\n                          <!-- Identity Verification -->\n                          <div class=\"card\" style=\"margin-bottom: 1rem;\">\n                            <div class=\"card-title\"\n                              style=\"margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;\">\n                              <span>ID Verification</span>\n                              <span class=\"badge ")
    ; __line = 1019
    ; __append(escapeFn( student.idVerified ? 'badge-green' : 'badge-red' ))
    ; __append("\"\n                                style=\"font-size: 9px;\">\n                                ")
    ; __line = 1021
    ; __append(escapeFn( student.idVerified ? 'Verified' : 'Unverified' ))
    ; __append("\n                              </span>\n                            </div>\n                            <div style=\"display:flex; flex-direction:column; gap:10px;\">\n                              ")
    ; __line = 1025
    ;  if (student.idProof) { 
    ; __append("\n                                <div\n                                  style=\"border: 1px solid var(--border); border-radius: 4px; overflow:hidden; background: var(--bg-input);\">\n                                  <img src=\"")
    ; __line = 1028
    ; __append(escapeFn( student.idProof ))
    ; __append("\" alt=\"ID Proof Doc\"\n                                    style=\"width:100%; height:auto; display:block; max-height: 120px; object-fit: contain;\">\n                                </div>\n                                <a href=\"")
    ; __line = 1031
    ; __append(escapeFn( student.idProof ))
    ; __append("\" target=\"_blank\" class=\"btn btn-ghost btn-xs\"\n                                  style=\"text-align:center;\">View Full Size Document</a>\n\n                                ")
    ; __line = 1034
    ;  if (!student.idVerified) { 
    ; __append("\n                                  <form action=\"/admin/students/")
    ; __line = 1035
    ; __append(escapeFn( student._id ))
    ; __append("/verify-id\" method=\"POST\"\n                                    style=\"margin:0;\">\n                                    <button type=\"submit\" class=\"btn btn-primary btn-xs btn-block\">Verify ID\n                                      Document</button>\n                                  </form>\n                                  ")
    ; __line = 1040
    ;  } 
    ; __append("\n                                    ")
    ; __line = 1041
    ;  } else { 
    ; __append("\n                                      <p style=\"font-size:0.75rem; color:var(--text-muted);\">No identity document\n                                        uploaded by the student yet.</p>\n                                      ")
    ; __line = 1044
    ;  } 
    ; __append("\n                            </div>\n                          </div>\n\n                          <div class=\"card\" style=\"margin-bottom: 1rem;\">\n                            <div class=\"card-title\" style=\"margin-bottom:1rem;\">Contact Card</div>\n\n                            <div style=\"display:flex; flex-direction:column; gap:12px;\">\n                              <div>\n                                <div style=\"font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;\">Email\n                                  Address</div>\n                                <div style=\"font-size:0.9rem; font-weight:500; word-break:break-all;\">\n                                  ")
    ; __line = 1056
    ; __append(escapeFn( student.email ))
    ; __append("\n                                </div>\n                              </div>\n                              <div>\n                                <div style=\"font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;\">Mobile\n                                  Number</div>\n                                <div style=\"font-size:0.9rem; font-weight:500; font-family:var(--mono);\">\n                                  ")
    ; __line = 1063
    ; __append(escapeFn( student.phone || '—' ))
    ; __append("\n                                </div>\n                              </div>\n                              <div>\n                                <div style=\"font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;\">\n                                  Admission Date</div>\n                                <div style=\"font-size:0.9rem; font-weight:500; font-family:var(--mono);\">\n                                  ")
    ; __line = 1070
    ; __append(escapeFn( student.enrollmentDate ? new
                                    Date(student.enrollmentDate).toLocaleDateString('en-IN',
                                    {day:'numeric',month:'short',year:'numeric'}) : new
                                    Date(student.createdAt).toLocaleDateString('en-IN',
                                    {day:'numeric',month:'short',year:'numeric'}) ))
    ; __line = 1074
    ; __append("\n                                </div>\n                              </div>\n                            </div>\n                          </div>\n\n                          <!-- Parent / Guardian Information -->\n                          <div class=\"card\" style=\"margin-bottom: 1rem;\">\n                            <div class=\"card-title\" style=\"margin-bottom:1rem;\">Parent / Guardian Info</div>\n                            <div style=\"display:flex; flex-direction:column; gap:12px;\">\n                              ")
    ; __line = 1084
    ;  if (student.fatherName || student.motherName || student.guardianPhone) { 
    ; __append("\n                                ")
    ; __line = 1085
    ;  if (student.fatherName) { 
    ; __append("\n                                  <div>\n                                    <div style=\"font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;\">\n                                      Father's Name</div>\n                                    <div style=\"font-size:0.85rem; font-weight:500;\">\n                                      ")
    ; __line = 1090
    ; __append(escapeFn( student.fatherName ))
    ; __append("\n                                    </div>\n                                  </div>\n                                  ")
    ; __line = 1093
    ;  } 
    ; __append("\n                                    ")
    ; __line = 1094
    ;  if (student.motherName) { 
    ; __append("\n                                      <div>\n                                        <div\n                                          style=\"font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;\">\n                                          Mother's Name</div>\n                                        <div style=\"font-size:0.85rem; font-weight:500;\">\n                                          ")
    ; __line = 1100
    ; __append(escapeFn( student.motherName ))
    ; __append("\n                                        </div>\n                                      </div>\n                                      ")
    ; __line = 1103
    ;  } 
    ; __append("\n                                        <div>\n                                          <div\n                                            style=\"font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;\">\n                                            Guardian Contact (")
    ; __line = 1107
    ; __append(escapeFn( student.guardianRelation || 'Relation' ))
    ; __append(")</div>\n                                          <div style=\"font-size:0.85rem; font-weight:600; font-family:var(--mono);\">\n                                            ")
    ; __line = 1109
    ;  if (student.guardianPhone) { 
    ; __append("\n                                              <a href=\"tel:")
    ; __line = 1110
    ; __append(escapeFn( student.guardianPhone ))
    ; __append("\"\n                                                style=\"color:var(--gold); display:flex; align-items:center; gap:4px;\">\n                                                <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"12\" height=\"12\"\n                                                  viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"\n                                                  stroke-linecap=\"round\" stroke-linejoin=\"round\">\n                                                  <path\n                                                    d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z\" />\n                                                </svg>\n                                                ")
    ; __line = 1118
    ; __append(escapeFn( student.guardianPhone ))
    ; __append("\n                                              </a>\n                                              ")
    ; __line = 1120
    ;  } else { 
    ; __append("\n                                                —\n                                                ")
    ; __line = 1122
    ;  } 
    ; __append("\n                                          </div>\n                                        </div>\n                                        ")
    ; __line = 1125
    ;  } else { 
    ; __append("\n                                          <p style=\"font-size:0.75rem; color:var(--text-muted);\">No parent/guardian\n                                            details captured. Update profile to add.</p>\n                                          ")
    ; __line = 1128
    ;  } 
    ; __append("\n                            </div>\n                          </div>\n\n                          <!-- Extended Profile Information -->\n                          <div class=\"card\" style=\"margin-bottom: 1rem;\">\n                            <div class=\"card-title\" style=\"margin-bottom:1rem;\">Extended Profile</div>\n                            <div style=\"display:flex; flex-direction:column; gap:10px; font-size:0.82rem;\">\n                              <div>\n                                <span style=\"color:var(--text-muted);\">DOB:</span>\n                                <strong class=\"mono\">\n                                  ")
    ; __line = 1139
    ; __append(escapeFn( student.dob ? new Date(student.dob).toLocaleDateString('en-IN',
                                    {day:'numeric',month:'short',year:'numeric'}) : '—' ))
    ; __line = 1140
    ; __append("\n                                </strong>\n                              </div>\n                              <div>\n                                <span style=\"color:var(--text-muted);\">Highest Qualification:</span>\n                                <strong>\n                                  ")
    ; __line = 1146
    ; __append(escapeFn( student.highestQualification || '—' ))
    ; __append("\n                                </strong>\n                              </div>\n                              <div>\n                                <span style=\"color:var(--text-muted);\">Lead Source:</span>\n                                <strong>\n                                  ")
    ; __line = 1152
    ; __append(escapeFn( student.referralSource || '—' ))
    ; __append("\n                                </strong>\n                              </div>\n                              <div>\n                                <span style=\"color:var(--text-muted);\">Social/Portfolio:</span>\n                                <strong>\n                                  ")
    ; __line = 1158
    ;  if (student.socialHandle) { 
    ; __append("\n                                    <a href=\"")
    ; __line = 1159
    ; __append(escapeFn( student.socialHandle.startsWith('http') ? student.socialHandle : 'https://' + student.socialHandle 
))
    ; __append("\"\n                                      target=\"_blank\" style=\"color:var(--gold);\">\n                                      ")
    ; __line = 1161
    ; __append(escapeFn( student.socialHandle ))
    ; __append("\n                                    </a>\n                                    ")
    ; __line = 1163
    ;  } else { 
    ; __append("\n                                      —\n                                      ")
    ; __line = 1165
    ;  } 
    ; __append("\n                                </strong>\n                              </div>\n                              <div style=\"border-top: 1px dashed var(--border); padding-top: 8px; margin-top: 4px;\">\n                                <div style=\"font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;\">\n                                  Permanent Address</div>\n                                <div style=\"font-size:0.8rem; line-height:1.4; font-weight:500;\">\n                                  ")
    ; __line = 1172
    ; __append(escapeFn( student.address || '—' ))
    ; __append("\n                                    ")
    ; __line = 1173
    ;  if (student.city) { 
    ; __append(", ")
    ; __append(escapeFn( student.city ))
    ; __append("\n                                        ")
    ; __line = 1174
    ;  } 
    ; __append("\n                                </div>\n                              </div>\n                            </div>\n                          </div>\n\n                          <!-- Assigned Teacher Profile -->\n                          <div class=\"card\" style=\"margin-bottom: 1rem;\">\n                            <div class=\"card-title\" style=\"margin-bottom:1rem;\">Primary Instructor</div>\n                            ")
    ; __line = 1183
    ;  if (student.teacher) { 
    ; __append("\n                              <div style=\"display:flex; align-items:center; gap:10px;\">\n                                <div class=\"avatar\" style=\"width:34px; height:34px; font-size:11px;\">\n                                  ")
    ; __line = 1186
    ; __append(escapeFn( student.teacher.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ))
    ; __append("\n          </div>\n          <div>\n            <a href=\"/admin/teachers/")
    ; __line = 1189
    ; __append(escapeFn( student.teacher._id ))
    ; __append("\" style=\"font-weight:600; color:var(--gold);\">")
    ; __append(escapeFn( student.teacher.name ))
    ; __append("</a>\n            <div style=\"font-size:0.7rem; color:var(--text-muted);\">Roll: ")
    ; __line = 1190
    ; __append(escapeFn( student.teacher.rollNumber || ' —' ))
    ; __append("\n                                </div>\n                              </div>\n                          </div>\n                          ")
    ; __line = 1194
    ;  } else { 
    ; __append("\n                            <p style=\"font-size:0.8rem; color:var(--text-muted);\">No primary teacher assigned. You can\n                              edit this user profile to assign one.</p>\n                            ")
    ; __line = 1197
    ;  } 
    ; __append("\n                        </div>\n\n                        <!-- Assigned Counsellor Profile -->\n                        <div class=\"card\">\n                          <div class=\"card-title\" style=\"margin-bottom:1rem;\">Assigned Counsellor</div>\n                          ")
    ; __line = 1203
    ;  if (student.counsellor) { 
    ; __append("\n                            <div style=\"display:flex; align-items:center; gap:10px;\">\n                              <div class=\"avatar\" style=\"width:34px; height:34px; font-size:11px;\">\n                                ")
    ; __line = 1206
    ; __append(escapeFn( student.counsellor.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ))
    ; __append("\n          </div>\n          <div>\n            <a href=\"/admin/counsellors/")
    ; __line = 1209
    ; __append(escapeFn( student.counsellor._id ))
    ; __append("\" style=\"font-weight:600; color:var(--gold);\">")
    ; __append(escapeFn( student.counsellor.name ))
    ; __append("</a>\n            <div style=\"font-size:0.7rem; color:var(--text-muted);\">Roll: ")
    ; __line = 1210
    ; __append(escapeFn( student.counsellor.rollNumber || ' —' ))
    ; __append("\n                              </div>\n                            </div>\n                        </div>\n                        ")
    ; __line = 1214
    ;  } else { 
    ; __append("\n                          <p style=\"font-size:0.8rem; color:var(--text-muted);\">No counsellor mapped to this student.\n                          </p>\n                          ")
    ; __line = 1217
    ;  } 
    ; __append("\n                      </div>\n                      </div>\n                      </div>\n\n                      <script>\n                        function openTab(evt, tabId) {\n                          const tabcontents = document.querySelectorAll(\".tab-content\");\n                          tabcontents.forEach(tab => tab.style.display = \"none\");\n\n                          const tablinks = document.querySelectorAll(\".tab-btn\");\n                          tablinks.forEach(link => {\n                            link.classList.remove(\"btn-primary\");\n                            link.classList.add(\"btn-ghost\");\n                          });\n\n                          document.getElementById(tabId).style.display = \"block\";\n                          evt.currentTarget.classList.remove(\"btn-ghost\");\n                          evt.currentTarget.classList.add(\"btn-primary\");\n                        }\n                      </script>")
    ; __line = 1237
