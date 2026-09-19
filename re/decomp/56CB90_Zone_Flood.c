int __thiscall sub_56CB90(int this, unsigned __int8 *a2, int a3, _DWORD *a4)
{
  unsigned __int8 *v4; // ebx
  int v5; // edi
  unsigned __int8 *v6; // ebp
  int v7; // ecx
  unsigned __int8 *v8; // esi
  __int64 v9; // rax
  int v10; // edx
  int v11; // edi
  __int64 v12; // rax
  int v13; // ebx
  int v14; // ecx
  int v15; // edx
  int v16; // edi
  int v17; // eax
  _DWORD *v18; // ecx
  int v19; // ecx
  int v20; // eax
  int v21; // eax
  int v22; // edx
  int v23; // ecx
  __int64 v24; // rax
  int v25; // edi
  __int64 v26; // rax
  int v27; // ebx
  int v28; // ecx
  int v29; // edx
  int v30; // edi
  int v31; // eax
  _DWORD *v32; // ecx
  int v33; // ecx
  int v34; // eax
  int v35; // eax
  int v36; // edx
  unsigned __int8 *v37; // ebp
  unsigned __int8 *v38; // esi
  int v39; // eax
  int v40; // edx
  unsigned __int8 *v41; // edi
  int v42; // ebx
  int v43; // esi
  __int64 v44; // rax
  __int64 v45; // rax
  int v46; // ebp
  int v47; // ecx
  int v48; // edx
  int v49; // esi
  int v50; // eax
  _DWORD *v51; // ecx
  int v52; // ecx
  int v53; // eax
  int v54; // eax
  int v55; // edx
  unsigned __int8 *v56; // ebp
  unsigned int v57; // esi
  int v58; // ebx
  int v59; // eax
  int v60; // ecx
  __int64 v61; // rax
  __int64 v62; // rax
  int v63; // edi
  int v64; // ecx
  int v65; // edx
  int v66; // esi
  int v67; // eax
  _DWORD *v68; // ecx
  int v69; // ecx
  int v70; // eax
  int v71; // eax
  int v72; // edx
  bool v74; // [esp+1Bh] [ebp-21h]
  int v76; // [esp+20h] [ebp-1Ch]
  int v77; // [esp+20h] [ebp-1Ch]
  int v78; // [esp+24h] [ebp-18h]
  int v79; // [esp+24h] [ebp-18h]
  int v80; // [esp+24h] [ebp-18h]
  int v81; // [esp+28h] [ebp-14h]
  int v82; // [esp+2Ch] [ebp-10h] BYREF
  int v83; // [esp+30h] [ebp-Ch] BYREF
  unsigned int v84; // [esp+34h] [ebp-8h]
  int v85; // [esp+38h] [ebp-4h]
  int v86; // [esp+40h] [ebp+4h]
  unsigned int v87; // [esp+48h] [ebp+Ch]

  v4 = a2;
  v5 = *a2;
  v74 = v5 == 6;
  v6 = a2;
  v7 = a2[1];
  v8 = a2;
  v81 = v5;
  do
  {
    v9 = v6[1] - v7;
    if ( (int)((HIDWORD(v9) ^ v9) - HIDWORD(v9)) >= 2 )
      break;
    *((_WORD *)v6 + 1) = a3;
    v10 = *(v6 - 4);
    v7 = v6[1];
    v6 -= 4;
  }
  while ( v10 == v5 );
  v76 = v7;
  v11 = *((unsigned __int16 *)v6 + 1);
  v78 = (unsigned __int16)v11;
  if ( (_WORD)v11 != 0 )
  {
    v12 = v6[1] - v7;
    if ( ((int)((HIDWORD(v12) ^ v12) - HIDWORD(v12)) < 2 || v74) && v11 != dword_ABDE8C && v11 != (unsigned __int16)a3 )
    {
      v13 = (unsigned __int16)a3 | ((unsigned __int16)v11 << 16);
      v14 = **(_DWORD **)(this + 20);
      v15 = *(_DWORD *)(v14 + 24 * (a3 & 0xF | (16 * (v11 & 0xF))) + 16);
      v16 = v14 + 24 * (a3 & 0xF | (16 * (v11 & 0xF)));
      v17 = v15 - 1;
      v18 = *(_DWORD **)(v16 + 4);
      if ( v15 - 1 < 0 )
      {
LABEL_12:
        v19 = *(_DWORD *)(v16 + 8);
        if ( v15 < v19
          || (*(_BYTE *)(v16 + 13) != 0 || v19 == 0)
          && (v20 = *(_DWORD *)(v16 + 20)) > 0
          && (*(unsigned __int8 (__thiscall **)(int, int, _DWORD))(*(_DWORD *)v16 + 8))(v16, v19 + v20, 0) != 0 )
        {
          v21 = *(_DWORD *)(v16 + 16);
          v22 = *(_DWORD *)(v16 + 4);
          *(_DWORD *)(v16 + 16) = v21 + 1;
          *(_DWORD *)(v22 + 8 * v21) = v13;
          *(_DWORD *)(v22 + 8 * v21 + 4) = v13;
        }
      }
      else
      {
        while ( v13 != *v18 )
        {
          v18 += 2;
          if ( --v17 < 0 )
            goto LABEL_12;
        }
      }
      v4 = a2;
      dword_ABDE8C = v78;
    }
  }
  if ( *v4 == v81 )
  {
    v23 = v76;
    do
    {
      v24 = v8[1] - v23;
      if ( (int)((HIDWORD(v24) ^ v24) - HIDWORD(v24)) >= 4 )
        break;
      *((_WORD *)v8 + 1) = a3;
      v23 = v8[1];
      v8 += 4;
      v76 = v23;
    }
    while ( *v8 == v81 );
  }
  v25 = *((unsigned __int16 *)v8 + 1);
  v79 = (unsigned __int16)v25;
  if ( (_WORD)v25 != 0 )
  {
    v26 = v8[1] - v76;
    if ( ((int)((HIDWORD(v26) ^ v26) - HIDWORD(v26)) < 2 || v74) && v25 != dword_ABDE8C && v25 != (unsigned __int16)a3 )
    {
      v27 = (unsigned __int16)a3 | ((unsigned __int16)v25 << 16);
      v28 = **(_DWORD **)(this + 20);
      v29 = *(_DWORD *)(v28 + 24 * (a3 & 0xF | (16 * (v25 & 0xF))) + 16);
      v30 = v28 + 24 * (a3 & 0xF | (16 * (v25 & 0xF)));
      v31 = v29 - 1;
      v32 = *(_DWORD **)(v30 + 4);
      if ( v29 - 1 < 0 )
      {
LABEL_31:
        v33 = *(_DWORD *)(v30 + 8);
        if ( v29 < v33
          || (*(_BYTE *)(v30 + 13) != 0 || v33 == 0)
          && (v34 = *(_DWORD *)(v30 + 20)) > 0
          && (*(unsigned __int8 (__thiscall **)(int, int, _DWORD))(*(_DWORD *)v30 + 8))(v30, v33 + v34, 0) != 0 )
        {
          v35 = *(_DWORD *)(v30 + 16);
          v36 = *(_DWORD *)(v30 + 4);
          *(_DWORD *)(v30 + 16) = v35 + 1;
          *(_DWORD *)(v36 + 8 * v35) = v27;
          *(_DWORD *)(v36 + 8 * v35 + 4) = v27;
        }
      }
      else
      {
        while ( v27 != *v32 )
        {
          v32 += 2;
          if ( --v31 < 0 )
            goto LABEL_31;
        }
      }
      dword_ABDE8C = v79;
    }
  }
  v77 = ((v8 - v6) >> 2) - 1;
  v37 = v6 + 4;
  v82 = 0;
  v83 = 0;
  *a4 = ((v8 - a2) >> 2) - 1;
  v38 = v8 - 4;
  v39 = *(_DWORD *)(this + 248) + *(_DWORD *)(this + 244) + 1;
  v40 = 4 * v39 + 4;
  v39 *= 4;
  v80 = v40;
  v41 = &v37[-v40];
  v85 = (int)&v37[v39 - 4];
  v86 = v39;
  v84 = (unsigned int)&v38[v40];
  v87 = (unsigned int)&v38[-v39 + 4];
  if ( (unsigned int)&v37[-v40] <= v87 )
  {
    while ( 1 )
    {
      v42 = *((unsigned __int16 *)v41 + 1);
      if ( (unsigned int)v41 >= v87 - 4 )
        v43 = (int)(v41 == (unsigned __int8 *)(v87 - 4) ? &v41[v86] : &v41[v86 - 4]);
      else
        v43 = (int)&v41[v80];
      if ( *((_WORD *)v41 + 1) != 0 )
        break;
      if ( *v41 != v81 )
        goto LABEL_62;
      v44 = v41[1] - *(unsigned __int8 *)(v43 + 1);
      if ( (int)((HIDWORD(v44) ^ v44) - HIDWORD(v44)) >= 2 )
        goto LABEL_62;
      v77 += sub_56CB90(v41, a3, &v82);
      v41 += 4 * v82;
LABEL_63:
      if ( (unsigned int)v41 > v87 )
        goto LABEL_64;
    }
    if ( v42 != (unsigned __int16)a3 && v42 != dword_ABDE8C )
    {
      v45 = v41[1] - *(unsigned __int8 *)(v43 + 1);
      if ( (int)((HIDWORD(v45) ^ v45) - HIDWORD(v45)) < 2 || v74 )
      {
        v46 = (unsigned __int16)a3 | (v42 << 16);
        v47 = **(_DWORD **)(this + 20);
        v48 = *(_DWORD *)(v47 + 24 * (a3 & 0xF | (16 * (v42 & 0xF))) + 16);
        v49 = v47 + 24 * (a3 & 0xF | (16 * (v42 & 0xF)));
        v50 = v48 - 1;
        v51 = *(_DWORD **)(v49 + 4);
        if ( v48 - 1 < 0 )
        {
LABEL_55:
          v52 = *(_DWORD *)(v49 + 8);
          if ( v48 < v52
            || (*(_BYTE *)(v49 + 13) != 0 || v52 == 0)
            && (v53 = *(_DWORD *)(v49 + 20)) > 0
            && (*(unsigned __int8 (__thiscall **)(int, int, _DWORD))(*(_DWORD *)v49 + 8))(v49, v52 + v53, 0) != 0 )
          {
            v54 = *(_DWORD *)(v49 + 16);
            v55 = *(_DWORD *)(v49 + 4);
            *(_DWORD *)(v49 + 16) = v54 + 1;
            *(_DWORD *)(v55 + 8 * v54) = v46;
            *(_DWORD *)(v55 + 8 * v54 + 4) = v46;
          }
        }
        else
        {
          while ( v46 != *v51 )
          {
            v51 += 2;
            if ( --v50 < 0 )
              goto LABEL_55;
          }
        }
        dword_ABDE8C = v42;
      }
    }
LABEL_62:
    v41 += 4;
    goto LABEL_63;
  }
LABEL_64:
  v56 = (unsigned __int8 *)v85;
  v57 = v84;
  if ( v85 <= v84 )
  {
    do
    {
      v58 = *((unsigned __int16 *)v56 + 1);
      if ( (unsigned int)v56 >= v57 - 4 )
      {
        v60 = v86;
        if ( v56 != (unsigned __int8 *)(v57 - 4) )
          v60 = v80;
        v59 = (int)&v56[-v60];
      }
      else
      {
        v59 = (int)&v56[-v86 + 4];
      }
      if ( *((_WORD *)v56 + 1) != 0 )
      {
        if ( v58 != (unsigned __int16)a3 && v58 != dword_ABDE8C )
        {
          v62 = v56[1] - *(unsigned __int8 *)(v59 + 1);
          if ( (int)((HIDWORD(v62) ^ v62) - HIDWORD(v62)) < 2 || v74 )
          {
            v63 = (unsigned __int16)a3 | (v58 << 16);
            v64 = **(_DWORD **)(this + 20);
            v65 = *(_DWORD *)(v64 + 24 * (a3 & 0xF | (16 * (v58 & 0xF))) + 16);
            v66 = v64 + 24 * (a3 & 0xF | (16 * (v58 & 0xF)));
            v67 = v65 - 1;
            v68 = *(_DWORD **)(v66 + 4);
            if ( v65 - 1 < 0 )
            {
LABEL_82:
              v69 = *(_DWORD *)(v66 + 8);
              if ( v65 < v69
                || (*(_BYTE *)(v66 + 13) != 0 || v69 == 0)
                && (v70 = *(_DWORD *)(v66 + 20)) > 0
                && (*(unsigned __int8 (__thiscall **)(int, int, _DWORD))(*(_DWORD *)v66 + 8))(v66, v69 + v70, 0) != 0 )
              {
                v71 = *(_DWORD *)(v66 + 16);
                v72 = *(_DWORD *)(v66 + 4);
                *(_DWORD *)(v66 + 16) = v71 + 1;
                *(_DWORD *)(v72 + 8 * v71) = v63;
                *(_DWORD *)(v72 + 8 * v71 + 4) = v63;
              }
            }
            else
            {
              while ( v63 != *v68 )
              {
                v68 += 2;
                if ( --v67 < 0 )
                  goto LABEL_82;
              }
            }
            dword_ABDE8C = v58;
          }
        }
        v57 = v84;
        v56 += 4;
      }
      else if ( *v56 == v81
             && (v61 = v56[1] - *(unsigned __int8 *)(v59 + 1), (int)((HIDWORD(v61) ^ v61) - HIDWORD(v61)) < 2) )
      {
        v77 += sub_56CB90(v56, a3, &v83);
        v56 += 4 * v83;
      }
      else
      {
        v56 += 4;
      }
    }
    while ( (unsigned int)v56 <= v57 );
  }
  return v77;
}
